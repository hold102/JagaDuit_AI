from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_analyzer       import analyze_message_sync
from services.risk_engine        import analyze_risk, get_action_guide, build_trusted_contact_message, build_recommendation
from services.reputation         import check_reputation
from services.scam_classifier    import classify
from services.dynamic_scoring    import compute

router = APIRouter()
logger = logging.getLogger(__name__)


class PaymentContext(BaseModel):
    recipient:         str = ""
    receiverName:      str = ""
    accountNumber:     str = ""
    phone:             str = ""
    amount:            str = ""
    purpose:           str = ""
    recipientType:     str = ""
    paymentPurpose:    str = ""
    requestSource:     str = ""
    source:            str = ""
    evidenceSource:    str = ""
    urgency:           str = ""
    isNewReceiver:     Optional[bool] = None
    is_new_receiver:   Optional[bool] = None
    selectedCallFlags: List[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    message: str
    payment_context: PaymentContext


class AnalyzeChatRequest(BaseModel):
    evidenceSource:   str = Field(default="other")
    messageText:      str
    amount:           str = ""
    recipientName:    str = ""
    recipientAccount: str = ""
    paymentContext:   str = "transfer_before_payment"


class AnalyzeCallRequest(BaseModel):
    evidenceSource:   str = Field(default="phone_call")
    inputMode:        str = Field(default="typed_summary")
    transcript:       str
    amount:           str = ""
    recipientName:    str = ""
    recipientAccount: str = ""
    paymentContext:   str = "transfer_before_payment"


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    return await _analyze(req)


@router.post("/analyze-risk")
async def analyze_risk_alias(req: AnalyzeRequest):
    return await _analyze(req)


@router.post("/analyze-chat")
async def analyze_chat(req: AnalyzeChatRequest):
    if not req.messageText.strip():
        raise HTTPException(status_code=422, detail="Message text is required")
    return await _analyze_text(
        message        = req.messageText,
        source         = req.evidenceSource,
        amount         = req.amount,
        recipient      = req.recipientName,
        account_number = req.recipientAccount,
        is_new_receiver= True,
    )


@router.post("/analyze-call")
async def analyze_call(req: AnalyzeCallRequest):
    if not req.transcript.strip():
        raise HTTPException(status_code=422, detail="Transcript is required")
    try:
        result = await _analyze_text(
            message        = req.transcript,
            source         = "phone_call",
            amount         = req.amount,
            recipient      = req.recipientName,
            account_number = req.recipientAccount,
            is_new_receiver= True,
        )
        result["inputMode"]      = req.inputMode
        result["evidenceSource"] = "phone_call"
        return result
    except Exception as exc:
        logger.exception("Call risk analysis failed")
        raise HTTPException(status_code=500, detail=f"Call risk analysis failed: {exc}")


async def _analyze(req: AnalyzeRequest):
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="Message is required")

    ctx       = req.payment_context.model_dump()
    recipient = ctx.get("receiverName") or ctx.get("recipient", "")
    source    = ctx.get("source") or ctx.get("requestSource", "") or ctx.get("evidenceSource", "")
    purpose   = ctx.get("purpose") or ctx.get("paymentPurpose", "")
    amount    = ctx.get("amount", "")

    loop = asyncio.get_event_loop()
    rule_result, ai_result, classifier_result, reputation_result = await asyncio.gather(
        loop.run_in_executor(None, _run_rules, req.message, ctx),
        loop.run_in_executor(None, analyze_message_sync, req.message, ctx),
        loop.run_in_executor(None, classify, req.message),
        loop.run_in_executor(None, check_reputation,
                             recipient,
                             ctx.get("accountNumber", ""),
                             ctx.get("phone", ""),
                             source, purpose, amount),
    )

    scored = compute(
        rule_score         = rule_result.riskScore,
        ai_risk_contrib    = ai_result.get("ai_risk_contribution", 0),
        classifier_prob    = classifier_result["probability"],
        reputation_score   = reputation_result.score,
        is_flagged_account = reputation_result.is_flagged_account,
    )

    seen = set()
    merged_flags = []
    for f in (ai_result.get("red_flags") or []) + rule_result.reasons + reputation_result.flags:
        if f not in seen:
            seen.add(f)
            merged_flags.append(f)

    scam_type    = ai_result.get("scam_type") or rule_result.scamType
    action_guide = get_action_guide(scam_type)
    trusted_msg  = build_trusted_contact_message(
        recipient       = recipient or "unknown",
        amount          = amount or "???",
        scam_type       = scam_type,
        risk_status     = scored.risk_status,
        message_snippet = req.message,
    )

    cooling_off  = {
        "enabled":         scored.risk_level == "high",
        "durationSeconds": 30 if scored.risk_level == "high" else 0,
        "message":         rule_result.coolingOff["message"] if scored.risk_level == "high"
                           else "Safety Check Passed.",
    }
    soft_warning = {
        "enabled": scored.risk_level == "medium",
        "message": rule_result.softWarning["message"] if scored.risk_level == "medium" else "",
    }

    return {
        "riskStatus":    scored.risk_status,
        "riskScore":     scored.final_score,
        "action":        scored.action,
        "scamType":      scam_type,
        "reasons":       merged_flags,
        "recommendation":build_recommendation(scored.risk_status, scam_type),
        "softWarning":   soft_warning,
        "coolingOff":    cooling_off,
        "risk_status":   scored.risk_status,
        "risk_score":    scored.final_score,
        "risk_level":    scored.risk_level,
        "scam_type":     scam_type,
        "red_flags":     merged_flags,
        "rule_contributions": rule_result.ruleContributions,
        "action_guide":  action_guide,
        "trusted_contact_message": trusted_msg,
        "signal_breakdown":  scored.signal_breakdown,
        "override_applied":  scored.override_applied,
        "override_reason":   scored.override_reason,
        "classifier":        classifier_result,
        "reputation_score":  reputation_result.score,
    }


async def _analyze_text(
    message: str,
    source: str = "",
    amount: str = "",
    recipient: str = "",
    account_number: str = "",
    is_new_receiver: bool = True,
) -> dict:
    """Shared 4-signal pipeline for /analyze-chat and /analyze-call."""
    loop = asyncio.get_event_loop()
    rule_result, ai_result, classifier_result, reputation_result = await asyncio.gather(
        loop.run_in_executor(None, lambda: analyze_risk(
            message        = message,
            isNewReceiver  = is_new_receiver,
            source         = source,
            receiverName   = recipient,
            amount         = amount,
        )),
        loop.run_in_executor(None, analyze_message_sync, message,
                             {"requestSource": source, "recipient": recipient, "amount": amount}),
        loop.run_in_executor(None, classify, message),
        loop.run_in_executor(None, check_reputation,
                             recipient, account_number, "", source, "", amount),
    )

    scored = compute(
        rule_score         = rule_result.riskScore,
        ai_risk_contrib    = ai_result.get("ai_risk_contribution", 0),
        classifier_prob    = classifier_result["probability"],
        reputation_score   = reputation_result.score,
        is_flagged_account = reputation_result.is_flagged_account,
    )

    seen = set()
    merged_flags = []
    for f in (ai_result.get("red_flags") or []) + rule_result.reasons + reputation_result.flags:
        if f not in seen:
            seen.add(f)
            merged_flags.append(f)

    scam_type = ai_result.get("scam_type") or rule_result.scamType

    if not merged_flags:
        merged_flags.append("No strong scam indicators found in the provided evidence.")

    return {
        "riskLevel":         scored.risk_status,
        "riskScore":         scored.final_score,
        "score":             scored.final_score,
        "reasons":           merged_flags,
        "recommendedAction": build_recommendation(scored.risk_status, scam_type),
        "risk_level":        scored.risk_level,
        "risk_score":        scored.final_score,
        "red_flags":         merged_flags,
        "scam_type":         scam_type,
        "rule_contributions":rule_result.ruleContributions,
        "action_guide":      get_action_guide(scam_type),
        "signal_breakdown":  scored.signal_breakdown,
        "reputation_score":  reputation_result.score,
    }


def _run_rules(message: str, ctx: dict):
    return analyze_risk(
        receiverName      = ctx.get("receiverName") or ctx.get("recipient", ""),
        amount            = ctx.get("amount", ""),
        purpose           = ctx.get("purpose") or ctx.get("paymentPurpose", ""),
        isNewReceiver     = _resolve_is_new_receiver(ctx),
        source            = ctx.get("source") or ctx.get("requestSource", "") or ctx.get("evidenceSource", ""),
        message           = message,
        selectedCallFlags = ctx.get("selectedCallFlags", []),
    )


def _resolve_is_new_receiver(ctx: dict) -> bool:
    if ctx.get("isNewReceiver") is not None:
        return bool(ctx["isNewReceiver"])
    if ctx.get("is_new_receiver") is not None:
        return bool(ctx["is_new_receiver"])
    return ctx.get("recipientType") in {"unknown", ""}
