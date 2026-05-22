from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.ai_analyzer     import analyze_message_sync
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

            if len(accumulated) < 30:
                await websocket.send_text(json.dumps({"status": "listening"}))
                continue

            try:
                # Run all four signals concurrently
                ai_result, rule_risk, classifier_result, reputation_result = \
                    await asyncio.gather(
                        loop.run_in_executor(None, analyze_message_sync, accumulated, {}),
                        loop.run_in_executor(None, _score_voice, accumulated),
                        loop.run_in_executor(None, classify, accumulated),
                        loop.run_in_executor(None, check_reputation,
                                             "", "", "", "phone_call", "", ""),
                    )

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
                    "signal_breakdown":      scored.signal_breakdown,
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
