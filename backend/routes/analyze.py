import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ai_analyzer import analyze_message_sync
from services.risk_engine import calculate_risk, get_action_guide, build_trusted_contact_message

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=4)


class PaymentContext(BaseModel):
    recipient: str = ""
    amount: str = ""
    recipientType: str = ""
    paymentPurpose: str = ""
    requestSource: str = ""
    urgency: str = ""


class AnalyzeRequest(BaseModel):
    message: str
    payment_context: PaymentContext


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
