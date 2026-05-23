from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.ai_analyzer     import DeepSeekError, analyze_message_sync
from services.risk_engine     import analyze_risk, get_action_guide, build_trusted_contact_message
from services.scam_classifier import classify
from services.reputation      import check_reputation
from services.dynamic_scoring import compute

router = APIRouter(prefix="/voice")


@router.websocket("/scan")
async def voice_scan(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_event_loop()

    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            accumulated = payload.get("accumulated", "").strip()

            # 30 chars ≈ 5-7 spoken words — not enough context for meaningful analysis
            if len(accumulated) < 30:
                await websocket.send_text(json.dumps({"status": "listening"}))
                continue

            try:
                # Run all four signals concurrently. DeepSeek can fail independently
                # if the API key is missing/expired, so live monitoring falls back
                # to local scoring instead of breaking the WebSocket stream.
                ai_result, rule_risk, classifier_result, reputation_result = \
                    await asyncio.gather(
                        loop.run_in_executor(None, analyze_message_sync, accumulated, {}),
                        loop.run_in_executor(None, _score_voice, accumulated),
                        loop.run_in_executor(None, classify, accumulated),
                        loop.run_in_executor(None, check_reputation,
                                             "", "", "", "phone_call", "", ""),
                        return_exceptions=True,
                    )

                if isinstance(rule_risk, Exception):
                    raise rule_risk
                if isinstance(classifier_result, Exception):
                    raise classifier_result
                if isinstance(reputation_result, Exception):
                    raise reputation_result

                deepseek_success = not isinstance(ai_result, Exception)
                deepseek_error = None
                if not deepseek_success:
                    if not isinstance(ai_result, DeepSeekError):
                        raise ai_result
                    deepseek_error = {
                        "status_code": ai_result.status_code,
                        "error_type": ai_result.error_type,
                        "message": str(ai_result),
                    }
                    ai_result = _fallback_ai_result(rule_risk)

                # Dynamic scoring
                scored = compute(
                    rule_score         = rule_risk.riskScore,
                    ai_risk_contrib    = ai_result.get("ai_risk_contribution", 0),
                    classifier_prob    = classifier_result["probability"],
                    reputation_score   = reputation_result.score,
                    is_flagged_account = reputation_result.is_flagged_account,
                )

                # Merge red flags
                ai_flags   = ai_result.get("red_flags") or []
                rule_flags = rule_risk.reasons or []
                seen = set()
                merged = []
                for f in ai_flags + rule_flags:
                    if f not in seen:
                        seen.add(f)
                        merged.append(f)

                scam_type = ai_result.get("scam_type") or rule_risk.scamType

                app_alert = rule_risk.appDownloadAlert or {"detected": False}
                otp_alert = rule_risk.otpAlert or {"detected": False}

                await websocket.send_text(json.dumps({
                    "status":                "analyzed",
                    "risk_score":            scored.final_score,
                    "risk_level":            scored.risk_level,
                    "risk_status":           scored.risk_status,
                    "scam_type":             scam_type,
                    "red_flags":             merged,
                    "emotional_pressure":    ai_result.get("emotional_pressure", False),
                    "impersonation_detected":ai_result.get("impersonation_detected", False),
                    "suspicious_link":       ai_result.get("suspicious_link", False),
                    "app_download_detected": app_alert.get("detected", False),
                    "app_download_alert":    app_alert,
                    "otp_solicitation_detected": otp_alert.get("detected", False),
                    "otp_alert":             otp_alert,
                    "signal_breakdown":      scored.signal_breakdown,
                    "deepseek_success":       deepseek_success,
                    "fallback_used":          not deepseek_success,
                    "deepseek_error":         deepseek_error,
                    "action_guide":          get_action_guide(scam_type),
                    "trusted_contact_message": build_trusted_contact_message(
                        recipient="caller",
                        amount="unknown",
                        scam_type=scam_type,
                        risk_status=scored.risk_status,
                        message_snippet=accumulated[:200],
                    ),
                }))

            except Exception as exc:
                await websocket.send_text(json.dumps({"status": "error", "detail": str(exc)}))

    except WebSocketDisconnect:
        pass


def _score_voice(transcript: str):
    return analyze_risk(
        message=transcript,
        isNewReceiver=True,  # caller is always unknown
        source="phone_call",
    )


def _fallback_ai_result(rule_risk) -> dict:
    flags = rule_risk.reasons or []
    return {
        "ai_risk_contribution": 0,
        "red_flags": flags,
        "scam_type": rule_risk.scamType,
        "emotional_pressure": any(
            key in rule_risk.ruleContributions
            for key in ("threat", "urgent_transfer_pressure", "keep_secret")
        ),
        "impersonation_detected": "authority_impersonation" in rule_risk.ruleContributions,
        "suspicious_link": "suspicious_link" in rule_risk.ruleContributions,
    }
