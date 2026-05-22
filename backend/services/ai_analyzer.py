"""
AI layer: uses Claude to extract scam intent, scam type, and red flags
from a suspicious message + payment context.
"""

import json
import os
import anthropic

_client = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


SYSTEM_PROMPT = """You are a Malaysian financial scam detection expert.
Analyse the user message and payment context for scam signals.
Return ONLY a valid JSON object — no markdown, no explanation — with this exact shape:

{
  "scam_type": "<string or null>",
  "red_flags": ["<string>", ...],
  "ai_risk_contribution": <integer 0-60>,
  "emotional_pressure": <boolean>,
  "impersonation_detected": <boolean>,
  "suspicious_link": <boolean>
}

scam_type options: "Parcel Fee Scam", "Fake Job Offer", "Investment Scam",
"Bank Freeze / Account Verification", "Fake Lucky Draw", "Other", null

red_flags: list of specific issues found (max 6, empty list if none).
ai_risk_contribution: how much the MESSAGE alone contributes to risk (0-60)."""


def analyze_message_sync(message: str, payment_context: dict) -> dict:
    """Synchronous wrapper — called from a thread pool by the async route."""
    prompt = f"""Suspicious message:
---
{message}
---

Payment context:
- Recipient type: {payment_context.get('recipientType', 'unknown')}
- Payment purpose: {payment_context.get('paymentPurpose', 'unknown')}
- Request source: {payment_context.get('requestSource', 'unknown')}
- Urgency felt by user: {payment_context.get('urgency', 'unknown')}
- Amount: RM {payment_context.get('amount', '?')}
- Recipient name: {payment_context.get('recipient', '?')}

Return the JSON analysis now."""

    client = get_client()
    response = client.messages.create(
        model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6"),
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    return json.loads(raw)
