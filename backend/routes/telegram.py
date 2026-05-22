from __future__ import annotations

import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.telegram_service import (
    send_code,
    verify_code,
    verify_2fa,
    list_recent_chats,
    fetch_messages,
    get_session,
    save_session,
    session_status,
)
from services.ai_analyzer import analyze_message_sync
from services.risk_engine import calculate_risk, get_action_guide, build_trusted_contact_message

router = APIRouter(prefix="/telegram")


class ConnectRequest(BaseModel):
    phone: str


class VerifyRequest(BaseModel):
    phone: str
    code: str


class ChatsRequest(BaseModel):
    phone: str


class TwoFARequest(BaseModel):
    phone: str
    password: str


class AnalyzeRequest(BaseModel):
    phone: str
    chat_id: str
    chat_name: str
    message_limit: int = 50


@router.get("/session-status")
def check_session(phone: str):
    """Returns whether the phone has a valid active session."""
    return session_status(phone)


@router.post("/connect")
async def connect(req: ConnectRequest):
    """Step 1 — send OTP to the user's Telegram account."""
    try:
        await send_code(req.phone)
        return {"status": "code_sent"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/verify")
async def verify(req: VerifyRequest):
    """Step 2 — verify OTP. Returns status: authenticated or 2fa_required."""
    try:
        result = await verify_code(req.phone, req.code)
        return result
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@router.post("/verify-2fa")
async def verify_two_fa(req: TwoFARequest):
    """Step 2b — verify two-step verification password."""
    try:
        await verify_2fa(req.phone, req.password)
        return {"status": "authenticated"}
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@router.post("/chats")
async def chats(req: ChatsRequest):
    """Step 3 — list recent chats so user can pick one."""
    session = get_session(req.phone)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated. Please connect first.")
    try:
        result = await list_recent_chats(session)
        return {"chats": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """Step 4 — fetch messages from the selected chat and run AI scam analysis."""
    session = get_session(req.phone)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated. Please connect first.")

    try:
        messages = await fetch_messages(session, int(req.chat_id), req.message_limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch messages: {exc}")

    if not messages:
        raise HTTPException(status_code=404, detail="No text messages found in this chat.")

    # Build a combined transcript for AI analysis
    transcript = "\n".join(
        f"[{'Me' if m['sender'] == 'me' else req.chat_name}]: {m['text']}"
        for m in messages
    )

    # Infer context from what we know
    payment_context = {
        "recipientType": "unknown",
        "paymentPurpose": "other",
        "requestSource": "telegram",
        "urgency": "unknown",
        "recipient": req.chat_name,
        "amount": "?",
    }

    loop = asyncio.get_event_loop()
    try:
        ai_result = await loop.run_in_executor(
            None, analyze_message_sync, transcript, payment_context
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {exc}")

    risk = calculate_risk(ai_result, payment_context)
    action_guide = get_action_guide(ai_result.get("scam_type"))
    trusted_msg = build_trusted_contact_message(
        recipient=req.chat_name,
        amount="?",
        scam_type=ai_result.get("scam_type"),
        risk_level=risk.risk_level,
        message_snippet=transcript[:300],
    )

    return {
        "scam_type": ai_result.get("scam_type"),
        "red_flags": ai_result.get("red_flags", []),
        "risk_score": risk.risk_score,
        "risk_level": risk.risk_level,
        "rule_contributions": risk.rule_contributions,
        "action_guide": action_guide,
        "trusted_contact_message": trusted_msg,
        "message_count": len(messages),
        "chat_name": req.chat_name,
    }
