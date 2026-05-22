from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.ai_analyzer import analyze_message_sync
from services.risk_engine import analyze_risk, get_action_guide

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
                # Run AI and rule engine concurrently
                ai_result, risk = await asyncio.gather(
                    loop.run_in_executor(None, analyze_message_sync, accumulated, {}),
                    loop.run_in_executor(None, _score_voice, accumulated),
                )

                # Blend: rule-based score + AI contribution (capped at 100)
                ai_contrib = min(ai_result.get("ai_risk_contribution", 0), 40)
                blended_score = min(risk.riskScore + ai_contrib, 100)

                # Re-derive level from blended score
                if blended_score >= 70:
                    level = "high"
                elif blended_score >= 40:
                    level = "medium"
                else:
                    level = "low"

                await websocket.send_text(json.dumps({
                    "status": "analyzed",
                    "risk_score": blended_score,
                    "risk_level": level,
                    "scam_type": ai_result.get("scam_type") or risk.scamType,
                    "red_flags": ai_result.get("red_flags") or risk.reasons,
                    "emotional_pressure": ai_result.get("emotional_pressure", False),
                    "impersonation_detected": ai_result.get("impersonation_detected", False),
                    "suspicious_link": ai_result.get("suspicious_link", False),
                }))
            except Exception as exc:
                await websocket.send_text(json.dumps({"status": "error", "detail": str(exc)}))

    except WebSocketDisconnect:
        pass


def _score_voice(transcript: str):
    """Score a voice transcript directly with the rule engine."""
    return analyze_risk(
        message=transcript,
        isNewReceiver=True,   # caller is always unknown
        source="phone_call",
    )
