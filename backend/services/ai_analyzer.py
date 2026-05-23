from __future__ import annotations

import json
import logging
import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

logger = logging.getLogger(__name__)

_client: OpenAI | None = None


class DeepSeekError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, error_type: str = "unknown"):
        super().__init__(message)
        self.status_code = status_code
        self.error_type = error_type


def get_deepseek_status() -> dict[str, Any]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    return {
        "deepseek_key_loaded": bool(api_key),
        "deepseek_model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        "key_preview": _preview_key(api_key),
        "note": "This endpoint does not expose the full API key.",
    }


def get_client() -> OpenAI:
    global _client
    if _client is None:
        logger.info("DeepSeek API key loaded: %s", bool(os.getenv("DEEPSEEK_API_KEY")))
        _client = OpenAI(
            api_key=os.environ["DEEPSEEK_API_KEY"],
            base_url="https://api.deepseek.com",
        )
    return _client


SYSTEM_PROMPT = """You are a Malaysian financial scam detection expert.
DeepSeek is the main semantic analyzer for JagaDuit AI.

Analyze only the provided scam evidence and payment context.
Do not invent facts. If information is missing, treat it as unknown.
Return ONLY a valid JSON object, with no markdown and no surrounding text.

Required JSON shape:
{
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "risk_score": <integer 0-100>,
  "detected_red_flags": ["<string>", ...],
  "explanation": "<short explanation based only on provided input>",
  "recommended_action": "<specific safety action>",
  "scam_type": "<string or null>"
}

Risk mapping:
0-39 LOW, 40-69 MEDIUM, 70-100 HIGH.

Always include every field. Keep detected_red_flags specific and concise."""


def analyze_message_sync(message: str, payment_context: dict) -> dict:
    prompt = f"""Suspicious evidence:
---
{message}
---

Payment context:
- Recipient type: {payment_context.get('recipientType', 'unknown')}
- Payment purpose: {payment_context.get('paymentPurpose') or payment_context.get('purpose', 'unknown')}
- Evidence source/channel: {payment_context.get('evidenceSource') or payment_context.get('requestSource') or payment_context.get('source', 'unknown')}
- Urgency felt by user: {payment_context.get('urgency', 'unknown')}
- Amount: RM {payment_context.get('amount', '?')}
- Recipient name: {payment_context.get('receiverName') or payment_context.get('recipient', '?')}
- Account number: {payment_context.get('accountNumber', '?')}

Return the JSON analysis now."""

    try:
        logger.info("Calling DeepSeek API...")
        client = get_client()
        response = client.chat.completions.create(
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
            max_tokens=700,
            temperature=0.1,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        logger.info("DeepSeek response received")
    except Exception as exc:
        status_code = getattr(exc, "status_code", None)
        error_type = exc.__class__.__name__
        logger.exception("DeepSeek failed: %s/%s", status_code, error_type)
        raise DeepSeekError(str(exc), status_code=status_code, error_type=error_type) from exc

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        return _normalize_deepseek_result(json.loads(raw.strip()))
    except Exception as exc:
        logger.exception("DeepSeek failed: invalid_json")
        raise DeepSeekError(f"Invalid JSON from DeepSeek: {exc}", error_type="invalid_json") from exc


def _normalize_deepseek_result(result: dict[str, Any]) -> dict[str, Any]:
    score = _clamp_score(result.get("risk_score", 0))
    level = str(result.get("risk_level") or _level_from_score(score)).upper()
    if level not in {"LOW", "MEDIUM", "HIGH"}:
        level = _level_from_score(score)

    flags = result.get("detected_red_flags")
    if flags is None:
        flags = result.get("red_flags", [])
    if not isinstance(flags, list):
        flags = [str(flags)]

    normalized = {
        "risk_level": level,
        "risk_score": score,
        "detected_red_flags": [str(flag) for flag in flags if str(flag).strip()],
        "explanation": str(result.get("explanation") or "DeepSeek analyzed the provided evidence."),
        "recommended_action": str(result.get("recommended_action") or _default_action(level)),
        "scam_type": result.get("scam_type"),
    }
    # Backward-compatible aliases for existing Telegram/Gmail/voice scoring code.
    normalized["red_flags"] = normalized["detected_red_flags"]
    normalized["ai_risk_contribution"] = round(normalized["risk_score"] * 0.6)
    normalized["emotional_pressure"] = _flag_contains(normalized["detected_red_flags"], ["urgent", "pressure", "threat"])
    normalized["impersonation_detected"] = _flag_contains(normalized["detected_red_flags"], ["impersonation", "police", "bank", "lhdn", "court"])
    normalized["suspicious_link"] = _flag_contains(normalized["detected_red_flags"], ["link", "url", "phishing"])
    return normalized


def _clamp_score(value: Any) -> int:
    try:
        score = int(float(value))
    except (TypeError, ValueError):
        score = 0
    return max(0, min(score, 100))


def _level_from_score(score: int) -> str:
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def _default_action(level: str) -> str:
    if level == "HIGH":
        return "Do not proceed with the transfer. Verify directly through official channels."
    if level == "MEDIUM":
        return "Pause and verify the recipient through a trusted channel before paying."
    return "Proceed only if you trust the recipient and the payment context is expected."


def _preview_key(api_key: str) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "****"
    if api_key.startswith("sk-"):
        return f"sk-xxxx...{api_key[-4:]}"
    return f"{api_key[:2]}...{api_key[-4:]}"


def _flag_contains(flags: list[str], terms: list[str]) -> bool:
    text = " ".join(flags).lower()
    return any(term in text for term in terms)
