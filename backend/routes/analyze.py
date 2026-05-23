from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_analyzer import DeepSeekError, analyze_message_sync, get_deepseek_status
from services.risk_engine import analyze_risk, get_action_guide, build_trusted_contact_message

router = APIRouter()
logger = logging.getLogger(__name__)


class PaymentContext(BaseModel):
    recipient: str = ""
    receiverName: str = ""
    accountNumber: str = ""
    phone: str = ""
    amount: str = ""
    purpose: str = ""
    recipientType: str = ""
    paymentPurpose: str = ""
    requestSource: str = ""
    source: str = ""
    evidenceSource: str = ""
    urgency: str = ""
    isNewReceiver: Optional[bool] = None
    is_new_receiver: Optional[bool] = None
    selectedCallFlags: List[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    message: str
    payment_context: PaymentContext = Field(default_factory=PaymentContext)


class AnalyzeChatRequest(BaseModel):
    evidenceSource: str = Field(default="other")
    messageText: str
    amount: str = ""
    recipientName: str = ""
    recipientAccount: str = ""
    paymentContext: str = "transfer_before_payment"


class AnalyzeCallRequest(BaseModel):
    evidenceSource: str = Field(default="phone_call")
    inputMode: str = Field(default="typed_summary")
    transcript: str
    amount: str = ""
    recipientName: str = ""
    recipientAccount: str = ""
    paymentContext: str = "transfer_before_payment"


@router.get("/debug/deepseek-status")
def deepseek_status():
    status = get_deepseek_status()
    status["frontend_origin"] = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    return status


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="Message is required")
    return await _deepseek_first_analysis(req.message, req.payment_context.model_dump())


@router.post("/analyze-risk")
async def analyze_risk_alias(req: AnalyzeRequest):
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="Message is required")
    return await _deepseek_first_analysis(req.message, req.payment_context.model_dump())


@router.post("/analyze-chat")
async def analyze_chat(req: AnalyzeChatRequest):
    if not req.messageText.strip():
        raise HTTPException(status_code=422, detail="Message text is required")
    return await _deepseek_first_analysis(
        req.messageText,
        {
            "requestSource": req.evidenceSource,
            "evidenceSource": req.evidenceSource,
            "amount": req.amount,
            "recipient": req.recipientName,
            "receiverName": req.recipientName,
            "accountNumber": req.recipientAccount,
            "paymentPurpose": req.paymentContext,
            "isNewReceiver": True,
        },
    )


@router.post("/analyze-call")
async def analyze_call(req: AnalyzeCallRequest):
    if not req.transcript.strip():
        raise HTTPException(status_code=422, detail="Transcript is required")
    result = await _deepseek_first_analysis(
        req.transcript,
        {
            "requestSource": "phone_call",
            "evidenceSource": "phone_call",
            "amount": req.amount,
            "recipient": req.recipientName,
            "receiverName": req.recipientName,
            "accountNumber": req.recipientAccount,
            "paymentPurpose": req.paymentContext,
            "isNewReceiver": True,
        },
    )
    result["inputMode"] = req.inputMode
    result["evidenceSource"] = "phone_call"
    return result


async def analyze_evidence(message: str, payment_context: dict[str, Any]) -> dict[str, Any]:
    return await _deepseek_first_analysis(message, payment_context)


async def _deepseek_first_analysis(message: str, ctx: dict[str, Any]) -> dict[str, Any]:
    loop = asyncio.get_event_loop()
    logger.info("Using local rule validation")
    rule_result = await loop.run_in_executor(None, _run_rules, message, ctx)

    deepseek_called = bool(os.getenv("DEEPSEEK_API_KEY"))
    deepseek_success = False
    deepseek_result: dict[str, Any] | None = None
    deepseek_error: dict[str, Any] | None = None

    if deepseek_called:
        try:
            deepseek_result = await loop.run_in_executor(None, analyze_message_sync, message, ctx)
            deepseek_success = True
        except DeepSeekError as exc:
            deepseek_error = {
                "status_code": exc.status_code,
                "error_type": exc.error_type,
                "message": str(exc),
            }
            logger.error("DeepSeek failed: %s", deepseek_error)
    else:
        logger.error("DeepSeek failed: missing DEEPSEEK_API_KEY")
        deepseek_error = {
            "status_code": None,
            "error_type": "missing_api_key",
            "message": "DEEPSEEK_API_KEY is not configured.",
        }

    if deepseek_success and deepseek_result:
        return _build_deepseek_validated_response(message, ctx, deepseek_result, rule_result)

    return _build_rule_fallback_response(message, ctx, rule_result, deepseek_called, deepseek_error)


def _build_deepseek_validated_response(
    message: str,
    ctx: dict[str, Any],
    deepseek_result: dict[str, Any],
    rule_result,
) -> dict[str, Any]:
    ds_score = _clamp_score(deepseek_result.get("risk_score", 0))
    rule_score = _clamp_score(rule_result.riskScore)
    rule_flags = list(rule_result.reasons or [])
    ds_flags = list(deepseek_result.get("detected_red_flags") or [])
    critical = _critical_flags(rule_result)

    final_score = ds_score
    override_applied = False
    override_reason = ""

    if critical:
        final_score = max(final_score, rule_score, 80)
        override_applied = True
        override_reason = "Local safety rules detected critical scam indicators."
    elif rule_score > ds_score + 15:
        final_score = rule_score
        override_applied = True
        override_reason = "Local safety score was materially higher than DeepSeek score."

    if _level_from_score(ds_score) == "HIGH" and _level_from_score(rule_score) == "HIGH":
        final_score = max(final_score, 85)

    final_level = _level_from_score(final_score)
    if _level_from_score(ds_score) == "HIGH":
        final_level = "HIGH"
        final_score = max(final_score, ds_score, 70)

    flags = _dedupe(ds_flags + rule_flags)
    if not flags:
        flags = ["No strong scam indicators found in the provided evidence."]

    explanation = _build_explanation(deepseek_result, override_applied, critical)
    recommended_action = _recommended_action(final_level)
    scam_type = deepseek_result.get("scam_type") or rule_result.scamType

    return _with_legacy_aliases(
        {
            "risk_level": final_level,
            "risk_score": final_score,
            "detected_red_flags": flags,
            "explanation": explanation,
            "recommended_action": recommended_action,
            "source": "deepseek_ai_with_rule_validation",
            "deepseek_called": True,
            "deepseek_success": True,
            "fallback_used": False,
            "override_applied": override_applied,
            "override_reason": override_reason,
            "deepseek_result": {
                "risk_level": deepseek_result.get("risk_level"),
                "risk_score": ds_score,
                "detected_red_flags": ds_flags,
                "explanation": deepseek_result.get("explanation", ""),
                "recommended_action": deepseek_result.get("recommended_action", ""),
                "scam_type": deepseek_result.get("scam_type"),
            },
            "rule_engine_result": _rule_summary(rule_result),
            "scam_type": scam_type,
            "action_guide": get_action_guide(scam_type),
            "trusted_contact_message": _trusted_contact_message(ctx, scam_type, final_level, message),
        }
    )


def _build_rule_fallback_response(
    message: str,
    ctx: dict[str, Any],
    rule_result,
    deepseek_called: bool,
    deepseek_error: dict[str, Any] | None,
) -> dict[str, Any]:
    final_score = _clamp_score(rule_result.riskScore)
    final_level = _level_from_score(final_score)
    flags = list(rule_result.reasons or ["DeepSeek unavailable; local emergency safety rules were used."])
    scam_type = rule_result.scamType

    return _with_legacy_aliases(
        {
            "risk_level": final_level,
            "risk_score": final_score,
            "detected_red_flags": flags,
            "explanation": "DeepSeek did not return a usable result, so JagaDuit returned the emergency local safety result.",
            "recommended_action": _recommended_action(final_level),
            "source": "local_rule_engine_emergency_fallback",
            "deepseek_called": deepseek_called,
            "deepseek_success": False,
            "fallback_used": True,
            "deepseek_error": deepseek_error,
            "override_applied": False,
            "override_reason": "",
            "deepseek_result": None,
            "rule_engine_result": _rule_summary(rule_result),
            "scam_type": scam_type,
            "action_guide": get_action_guide(scam_type),
            "trusted_contact_message": _trusted_contact_message(ctx, scam_type, final_level, message),
        }
    )


def _with_legacy_aliases(result: dict[str, Any]) -> dict[str, Any]:
    risk_level = result["risk_level"]
    risk_score = result["risk_score"]
    flags = result["detected_red_flags"]
    risk_status = "UNSAFE" if risk_level == "HIGH" else "SAFE"
    community_intelligence = (result.get("rule_engine_result") or {}).get("community_intelligence") or {
        "used": False,
        "scoreBoost": 0,
        "message": "",
    }

    result.update(
        {
            "riskStatus": risk_status,
            "riskScore": risk_score,
            "riskLevel": risk_status,
            "score": risk_score,
            "action": "COOLING_OFF_MODE" if risk_level == "HIGH" else "PROCEED_TRANSFER",
            "scamType": result.get("scam_type"),
            "reasons": flags,
            "red_flags": flags,
            "recommendation": result["recommended_action"],
            "recommendedAction": result["recommended_action"],
            "community_intelligence": community_intelligence,
            "softWarning": {
                "enabled": risk_level == "MEDIUM",
                "message": "This payment has some unusual signs. Please verify the receiver before proceeding."
                if risk_level == "MEDIUM"
                else "",
            },
            "coolingOff": {
                "enabled": risk_level == "HIGH",
                "durationSeconds": 30 if risk_level == "HIGH" else 0,
                "message": "Cooling-Off Mode Activated. Please wait 30 seconds and verify before proceeding."
                if risk_level == "HIGH"
                else "Safety Check Passed.",
            },
        }
    )
    return result


def _run_rules(message: str, ctx: dict[str, Any]):
    return analyze_risk(
        receiverName=ctx.get("receiverName") or ctx.get("recipient", ""),
        amount=ctx.get("amount", ""),
        purpose=ctx.get("purpose") or ctx.get("paymentPurpose", ""),
        isNewReceiver=_resolve_is_new_receiver(ctx),
        source=ctx.get("source") or ctx.get("requestSource", "") or ctx.get("evidenceSource", ""),
        message=message,
        selectedCallFlags=ctx.get("selectedCallFlags", []),
    )


def _resolve_is_new_receiver(ctx: dict[str, Any]) -> bool:
    if ctx.get("isNewReceiver") is not None:
        return bool(ctx["isNewReceiver"])
    if ctx.get("is_new_receiver") is not None:
        return bool(ctx["is_new_receiver"])
    recipient = f"{ctx.get('receiverName', '')} {ctx.get('recipient', '')}".lower()
    return ctx.get("recipientType") in {"unknown", ""} or "unknown" in recipient


def _rule_summary(rule_result) -> dict[str, Any]:
    community_patterns = {
        key: value
        for key, value in rule_result.ruleContributions.items()
        if key == "community_reported_pattern"
    }
    return {
        "risk_level": _level_from_score(rule_result.riskScore),
        "risk_score": rule_result.riskScore,
        "detected_red_flags": rule_result.reasons,
        "rule_contributions": rule_result.ruleContributions,
        "community_intelligence": {
            "used": bool(community_patterns),
            "scoreBoost": community_patterns.get("community_reported_pattern", 0),
            "message": "Community intelligence: Similar scam pattern found in previous reports."
            if community_patterns
            else "",
        },
        "app_download_detected": bool((rule_result.appDownloadAlert or {}).get("detected")),
        "otp_solicitation_detected": bool((rule_result.otpAlert or {}).get("detected")),
    }


def _critical_flags(rule_result) -> list[str]:
    critical_keys = {
        "otp_solicitation",
        "app_download_solicitation",
        "authority_impersonation",
        "threat",
        "account_verification",
        "suspicious_link",
        "urgent_transfer_pressure",
        "keep_secret",
        "guaranteed_investment_return",
        "job_upfront_payment",
        "parcel_payment_scam",
        "third_party_or_mule_transfer",
        "unknown_large_transfer",
    }
    return [key for key in rule_result.ruleContributions if key in critical_keys]


def _build_explanation(deepseek_result: dict[str, Any], override_applied: bool, critical: list[str]) -> str:
    base = str(deepseek_result.get("explanation") or "DeepSeek analysis completed.")
    if override_applied and critical:
        return (
            f"{base} JagaDuit Safety Engine also confirmed critical scam indicators, "
            "so the final result was escalated for consistency."
        )
    if override_applied:
        return f"{base} JagaDuit Safety Engine returned a higher deterministic risk score, so the final score was adjusted."
    return f"{base} JagaDuit Safety Engine validated the result with deterministic scam checks."


def _recommended_action(level: str) -> str:
    if level == "HIGH":
        return "Do not proceed with the transfer. Verify directly through official bank channels."
    if level == "MEDIUM":
        return "Pause and verify the recipient through a trusted official channel before paying."
    return "Proceed only if the request and recipient are expected and trusted."


def _trusted_contact_message(ctx: dict[str, Any], scam_type: str, risk_level: str, message: str) -> str:
    return build_trusted_contact_message(
        recipient=ctx.get("receiverName") or ctx.get("recipient") or "unknown",
        amount=ctx.get("amount") or "???",
        scam_type=scam_type,
        risk_level=risk_level,
        message_snippet=message,
    )


def _clamp_score(value: Any) -> int:
    try:
        score = int(float(value))
    except (TypeError, ValueError):
        score = 0
    return max(0, min(score, 100))


def _level_from_score(score: int) -> str:
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def _dedupe(values: list[str]) -> list[str]:
    seen = set()
    output = []
    for value in values:
        value = str(value).strip()
        if value and value not in seen:
            seen.add(value)
            output.append(value)
    return output
