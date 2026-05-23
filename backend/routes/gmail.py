from __future__ import annotations

import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from services.gmail_service import (
    get_auth_url, exchange_code, get_credentials,
    save_session, list_emails, fetch_email_body,
)
from services.ai_analyzer     import analyze_message_sync
from services.risk_engine     import analyze_risk, get_action_guide, build_trusted_contact_message
from services.scam_classifier import classify
from services.reputation      import check_reputation
from services.dynamic_scoring import compute

router = APIRouter(prefix="/gmail")


class AnalyzeRequest(BaseModel):
    session_token: str
    email_id:      str
    sender:        str
    subject:       str


class EmailsRequest(BaseModel):
    session_token: str


@router.get("/auth-url")
def auth_url():
    """Step 1 — get Google OAuth URL to redirect user to."""
    url, state = get_auth_url()
    return {"auth_url": url, "state": state}


@router.get("/callback")
def callback(code: str, state: str):
    """Step 2 — Google redirects here after user grants permission."""
    try:
        exchange_code(code, state)
        frontend = f"http://localhost:5173/gmail?session={state}&status=ok"
        return RedirectResponse(url=frontend)
    except Exception as exc:
        frontend = f"http://localhost:5173/gmail?status=error&detail={exc}"
        return RedirectResponse(url=frontend)


@router.post("/emails")
def emails(req: EmailsRequest):
    """Step 3 — list recent inbox emails."""
    creds = get_credentials(req.session_token)
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated. Please connect Gmail first.")
    try:
        return {"emails": list_emails(req.session_token)}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """Step 4 — fetch email body and run full 4-signal analysis."""
    creds = get_credentials(req.session_token)
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    try:
        body = fetch_email_body(req.session_token, req.email_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch email: {exc}")

    if not body.strip():
        raise HTTPException(status_code=404, detail="Email has no readable text content.")

    # Combine subject + body for richer analysis
    full_text = f"Subject: {req.subject}\n\n{body}"

    loop = asyncio.get_event_loop()
    ai_result, rule_risk, classifier_result, reputation_result = await asyncio.gather(
        loop.run_in_executor(None, analyze_message_sync, full_text, {"requestSource": "email"}),
        loop.run_in_executor(None, _score_email, full_text),
        loop.run_in_executor(None, classify, full_text),
        loop.run_in_executor(None, check_reputation,
                             req.sender, "", "", "email", "", ""),
    )

    scored = compute(
        rule_score         = rule_risk.riskScore,
        ai_risk_contrib    = ai_result.get("ai_risk_contribution", 0),
        classifier_prob    = classifier_result["probability"],
        reputation_score   = reputation_result.score,
        is_flagged_account = reputation_result.is_flagged_account,
    )

    seen = set()
    merged_flags = []
    for f in (ai_result.get("red_flags") or []) + rule_risk.reasons + reputation_result.flags:
        if f not in seen:
            seen.add(f)
            merged_flags.append(f)

    scam_type = ai_result.get("scam_type") or rule_risk.scamType

    return {
        "scam_type":               scam_type,
        "red_flags":               merged_flags,
        "risk_score":              scored.final_score,
        "risk_level":              scored.risk_level,
        "risk_status":             scored.risk_status,
        "signal_breakdown":        scored.signal_breakdown,
        "rule_contributions":      rule_risk.ruleContributions,
        "action_guide":            get_action_guide(scam_type),
        "trusted_contact_message": build_trusted_contact_message(
            recipient      = req.sender,
            amount         = "unknown",
            scam_type      = scam_type,
            risk_status    = scored.risk_status,
            message_snippet= full_text[:300],
        ),
        "email_subject": req.subject,
        "email_sender":  req.sender,
    }


def _score_email(text: str):
    return analyze_risk(message=text, isNewReceiver=True, source="email")
