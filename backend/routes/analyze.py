from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.risk_engine import analyze_risk, get_action_guide, build_trusted_contact_message

router = APIRouter()


class PaymentContext(BaseModel):
    recipient: str = ""
    receiverName: str = ""
    amount: str = ""
    purpose: str = ""
    recipientType: str = ""
    paymentPurpose: str = ""
    requestSource: str = ""
    source: str = ""
    urgency: str = ""
    isNewReceiver: Optional[bool] = None
    is_new_receiver: Optional[bool] = None
    selectedCallFlags: List[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    message: str
    payment_context: PaymentContext


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    return _analyze_rule_based(req)


@router.post("/analyze-risk")
async def analyze_risk_alias(req: AnalyzeRequest):
    return _analyze_rule_based(req)


def _analyze_rule_based(req: AnalyzeRequest):
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="Message is required")

    ctx = req.payment_context.model_dump()

    # Optional AI explanation/enrichment can be added here later.
    risk = analyze_risk(
        receiverName=ctx.get("receiverName") or ctx.get("recipient", ""),
        amount=ctx.get("amount", ""),
        purpose=ctx.get("purpose") or ctx.get("paymentPurpose", ""),
        isNewReceiver=_resolve_is_new_receiver(ctx),
        source=ctx.get("source") or ctx.get("requestSource", ""),
        message=req.message,
        selectedCallFlags=ctx.get("selectedCallFlags", []),
    )
    action_guide = get_action_guide(risk.scamType)
    trusted_msg = build_trusted_contact_message(
        recipient=ctx.get("recipient") or ctx.get("receiverName") or "unknown",
        amount=ctx.get("amount", "???"),
        scam_type=risk.scamType,
        risk_status=risk.riskStatus,
        message_snippet=req.message,
    )

    return {
        "riskStatus": risk.riskStatus,
        "riskScore": risk.riskScore,
        "action": risk.action,
        "scamType": risk.scamType,
        "reasons": risk.reasons,
        "recommendation": risk.recommendation,
        "softWarning": risk.softWarning,
        "coolingOff": risk.coolingOff,
        "risk_status": risk.riskStatus,
        "risk_score": risk.riskScore,
        "risk_level": risk.riskStatus,
        "scam_type": risk.scamType,
        "red_flags": risk.reasons,
        "rule_contributions": risk.ruleContributions,
        "action_guide": action_guide,
        "trusted_contact_message": trusted_msg,
    }


def _resolve_is_new_receiver(ctx: dict) -> bool:
    if ctx.get("isNewReceiver") is not None:
        return bool(ctx["isNewReceiver"])
    if ctx.get("is_new_receiver") is not None:
        return bool(ctx["is_new_receiver"])
    return ctx.get("recipientType") in {"unknown", ""}
