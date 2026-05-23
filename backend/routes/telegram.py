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
from services.ai_analyzer     import analyze_message_sync
from services.risk_engine      import analyze_risk, get_action_guide, build_trusted_contact_message
from services.scam_classifier  import classify
from services.reputation       import check_reputation
from services.dynamic_scoring  import compute

router = APIRouter(prefix="/telegram")


def _score_telegram(transcript: str):
    # All Telegram contacts are treated as new receivers — the user scanned this
    # chat precisely because they are uncertain about the sender.
    return analyze_risk(
        message=transcript,
        isNewReceiver=True,
        source="telegram",
    )


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

    # Labelling each message lets DeepSeek reason about who is making the demands;
    # scam patterns are usually one-sided — only the "other" side asks for money/OTP.
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
        ai_result, rule_risk, classifier_result, reputation_result = \
            await asyncio.gather(
                loop.run_in_executor(None, analyze_message_sync, transcript, payment_context),
                loop.run_in_executor(None, _score_telegram, transcript),
                loop.run_in_executor(None, classify, transcript),
                loop.run_in_executor(None, check_reputation,
                                     req.chat_name, "", "", "telegram", "", ""),
            )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Analysis failed: {exc}")

    # Dynamic scoring with all four signals
    scored = compute(
        rule_score         = rule_risk.riskScore,
        ai_risk_contrib    = ai_result.get("ai_risk_contribution", 0),
        classifier_prob    = classifier_result["probability"],
        reputation_score   = reputation_result.score,
        is_flagged_account = reputation_result.is_flagged_account,
    )

    # Merge red flags from all sources
    ai_flags   = ai_result.get("red_flags") or []
    rule_flags = rule_risk.reasons or []
    rep_flags  = reputation_result.flags or []
    seen = set()
    merged_flags = []
    for f in ai_flags + rule_flags + rep_flags:
        if f not in seen:
            seen.add(f)
            merged_flags.append(f)

    scam_type    = ai_result.get("scam_type") or rule_risk.scamType
    action_guide = get_action_guide(scam_type)
    trusted_msg  = build_trusted_contact_message(
        recipient      = req.chat_name,
        amount         = "?",
        scam_type      = scam_type,
        risk_status    = scored.risk_status,
        message_snippet= transcript[:300],
    )

    return {
        "scam_type":              scam_type,
        "red_flags":              merged_flags,
        "risk_score":             scored.final_score,
        "risk_level":             scored.risk_level,
        "risk_status":            scored.risk_status,
        "rule_contributions":     rule_risk.ruleContributions,
        "signal_breakdown":       scored.signal_breakdown,
        "action_guide":           action_guide,
        "trusted_contact_message":trusted_msg,
        "message_count":          len(messages),
        "chat_name":              req.chat_name,
    }
