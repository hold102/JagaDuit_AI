from __future__ import annotations

import json
import os
from openai import OpenAI

# Singleton avoids creating a new HTTP connection pool on every request
_client = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        # DeepSeek exposes an OpenAI-compatible API — we reuse the OpenAI SDK
        _client = OpenAI(
            api_key=os.environ["DEEPSEEK_API_KEY"],
            base_url="https://api.deepseek.com",
        )
    return _client


# Strict JSON-only instruction avoids markdown fences that would break json.loads;
# max_tokens=512 keeps latency low — the structured output is short by design.
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
# Cap at 60 so AI alone cannot trigger UNSAFE — it must agree with at least one other signal


def analyze_message_sync(message: str, payment_context: dict) -> dict:
    """Synchronous wrapper — called from a thread pool by the async route."""
    prompt = f"""Suspicious message:
---
{message}
---

Payment context:
- Recipient type: {payment_context.get('recipientType', 'unknown')}
- Payment purpose: {payment_context.get('paymentPurpose', 'unknown')}
- Evidence source: {payment_context.get('evidenceSource') or payment_context.get('requestSource', 'unknown')}
- Urgency felt by user: {payment_context.get('urgency', 'unknown')}
- Amount: RM {payment_context.get('amount', '?')}
- Recipient name: {payment_context.get('recipient', '?')}

Return the JSON analysis now."""

    client = get_client()
    response = client.chat.completions.create(
        model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        max_tokens=512,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )

    raw = response.choices[0].message.content.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
