import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_analyzer import analyze_message_sync
from services.risk_engine import (
    analyze_call_summary,
    analyze_chat_evidence,
    calculate_risk,
    get_action_guide,
    build_trusted_contact_message,
)

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=4)
logger = logging.getLogger(__name__)


class PaymentContext(BaseModel):
    recipient: str = ""
    amount: str = ""
    recipientType: str = ""
    paymentPurpose: str = ""
    requestSource: str = ""
    evidenceSource: str = ""
    urgency: str = ""


class AnalyzeRequest(BaseModel):
    message: str
    payment_context: PaymentContext


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


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="Message is required")

    ctx = req.payment_context.model_dump()

    loop = asyncio.get_event_loop()
    try:
        ai_result = await loop.run_in_executor(
            _executor, analyze_message_sync, req.message, ctx
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {exc}")

    risk = calculate_risk(ai_result, ctx)
    action_guide = get_action_guide(ai_result.get("scam_type"))
    trusted_msg = build_trusted_contact_message(
        recipient=ctx.get("recipient", "unknown"),
        amount=ctx.get("amount", "???"),
        scam_type=ai_result.get("scam_type"),
        risk_level=risk.risk_level,
        message_snippet=req.message,
    )

    return {
        "scam_type": ai_result.get("scam_type"),
        "red_flags": ai_result.get("red_flags", []),
        "risk_score": risk.risk_score,
        "risk_level": risk.risk_level,
        "rule_contributions": risk.rule_contributions,
        "action_guide": action_guide,
        "trusted_contact_message": trusted_msg,
    }


@router.post("/analyze-chat")
async def analyze_chat(req: AnalyzeChatRequest):
    if not req.messageText.strip():
        raise HTTPException(status_code=422, detail="Message text is required")

    result = analyze_chat_evidence(
        evidence_source=req.evidenceSource,
        message_text=req.messageText,
        amount=req.amount,
        recipient_name=req.recipientName,
        recipient_account=req.recipientAccount,
        payment_context=req.paymentContext,
    )

    return result


@router.post("/analyze-call")
async def analyze_call(req: AnalyzeCallRequest):
    if not req.transcript.strip():
        raise HTTPException(status_code=422, detail="Transcript is required")

    try:
        result = analyze_call_summary(
            transcript=req.transcript,
            amount=req.amount,
            recipient_name=req.recipientName,
            recipient_account=req.recipientAccount,
            payment_context=req.paymentContext,
            input_mode=req.inputMode,
        )
    except Exception as exc:
        logger.exception("Call risk analysis failed")
        raise HTTPException(status_code=500, detail=f"Call risk analysis failed: {exc}")

    return result
