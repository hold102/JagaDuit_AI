from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.ai_analyzer import analyze_message_sync
from services.risk_engine import calculate_risk

router = APIRouter(prefix="/voice")

PAYMENT_CONTEXT = {
    "recipientType": "unknown",
    "paymentPurpose": "other",
    "requestSource": "phone_call",
    "urgency": "unknown",
    "recipient": "caller",
    "amount": "?",
}


@router.websocket("/scan")
async def voice_scan(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_event_loop()

    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            accumulated = payload.get("accumulated", "").strip()

            # Need enough text for meaningful analysis
            if len(accumulated) < 30:
                await websocket.send_text(json.dumps({"status": "listening"}))
                continue

            try:
                ai_result = await loop.run_in_executor(
                    None, analyze_message_sync, accumulated, PAYMENT_CONTEXT
                )
                risk = calculate_risk(ai_result, PAYMENT_CONTEXT)

                await websocket.send_text(json.dumps({
                    "status": "analyzed",
                    "risk_score": risk.risk_score,
                    "risk_level": risk.risk_level,
                    "scam_type": ai_result.get("scam_type"),
                    "red_flags": ai_result.get("red_flags", []),
                    "emotional_pressure": ai_result.get("emotional_pressure", False),
                    "impersonation_detected": ai_result.get("impersonation_detected", False),
                    "suspicious_link": ai_result.get("suspicious_link", False),
                }))
            except Exception as exc:
                await websocket.send_text(json.dumps({"status": "error", "detail": str(exc)}))

    except WebSocketDisconnect:
        pass
