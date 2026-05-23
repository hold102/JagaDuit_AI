from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPORTS_PATH = Path(__file__).resolve().parents[1] / "data" / "scam_reports.json"

PATTERN_KEYWORDS = {
    "account_frozen_claim": ["account frozen", "account suspended", "akaun dibekukan", "akaun digantung"],
    "immediate_transfer_request": ["transfer immediately", "transfer now", "send money now", "pay now"],
    "secrecy": ["do not tell anyone", "don't tell anyone", "keep secret", "jangan beritahu"],
    "otp_password_request": ["otp", "tac", "password", "one-time passcode"],
    "courier_fee": ["courier fee", "delivery fee", "parcel fee", "customs fee", "release parcel"],
    "investment_return": ["guaranteed return", "investment return", "30% in 3 days", "sure profit"],
    "fake_payment_proof": ["proof of payment", "payment receipt", "bank slip"],
}

SENSITIVE_PATTERNS = [
    re.compile(r"\b(?:otp|tac|password|passcode|pin)\s*[:=-]?\s*\S+", re.IGNORECASE),
    re.compile(r"\b\d{10,18}\b"),
    re.compile(r"\b\d{6}\b"),
]


def store_scam_report(payload: dict[str, Any]) -> dict[str, Any]:
    reports = _load_reports()
    report = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "evidence_source": _safe_text(payload.get("evidenceSource")),
        "scam_type": _safe_text(payload.get("scamType")),
        "risk_level": _safe_text(payload.get("riskLevel")),
        "risk_score": _safe_int(payload.get("riskScore")),
        "detected_indicators": _safe_list(payload.get("detectedIndicators")),
        "anonymized_summary": sanitize_summary(payload.get("anonymizedSummary", "")),
        "amount_range": _safe_text(payload.get("amountRange")),
        "payment_context": _safe_text(payload.get("paymentContext")),
        "user_action": _safe_text(payload.get("userAction")),
        "status": "new",
    }
    reports.append(report)
    _save_reports(reports)
    return report


def list_scam_reports() -> list[dict[str, Any]]:
    reports = _load_reports()
    return [
        {
            "id": _safe_text(report.get("id")),
            "created_at": _safe_text(report.get("created_at")),
            "evidence_source": _safe_text(report.get("evidence_source")),
            "scam_type": _safe_text(report.get("scam_type")),
            "risk_level": _safe_text(report.get("risk_level")),
            "risk_score": _safe_int(report.get("risk_score")),
            "detected_indicators": _safe_list(report.get("detected_indicators")),
            "anonymized_summary": sanitize_summary(report.get("anonymized_summary", "")),
            "amount_range": _safe_text(report.get("amount_range")),
            "payment_context": _safe_text(report.get("payment_context")),
            "user_action": _safe_text(report.get("user_action")),
            "status": _safe_text(report.get("status")),
        }
        for report in reversed(reports)
    ]


def check_community_scam_patterns(message_text: str) -> dict[str, Any]:
    text = str(message_text or "").lower()
    matched = []
    for key, phrases in PATTERN_KEYWORDS.items():
        if any(phrase in text for phrase in phrases):
            matched.append(key)

    if not matched:
        return {"matchedPatterns": [], "scoreBoost": 0, "reason": ""}

    reports = _load_reports()
    reported_indicators = []
    for report in reports:
        reported_indicators.extend(report.get("detected_indicators") or [])

    repeated = [key for key in matched if reported_indicators.count(key) >= 2]
    score_boost = min(10, 3 * len(matched) + 2 * len(repeated))
    return {
        "matchedPatterns": matched,
        "scoreBoost": score_boost,
        "reason": "Community intelligence: Similar scam pattern found in previous reports.",
    }


def sanitize_summary(value: Any) -> str:
    text = str(value or "").strip()
    for pattern in SENSITIVE_PATTERNS:
        text = pattern.sub("[redacted]", text)
    return text[:600]


def _load_reports() -> list[dict[str, Any]]:
    if not REPORTS_PATH.exists():
        return []
    try:
        return json.loads(REPORTS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _save_reports(reports: list[dict[str, Any]]) -> None:
    REPORTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORTS_PATH.write_text(json.dumps(reports, indent=2), encoding="utf-8")


def _safe_text(value: Any) -> str:
    return sanitize_summary(value)[:120]


def _safe_int(value: Any) -> int:
    try:
        return max(0, min(int(float(value)), 100))
    except (TypeError, ValueError):
        return 0


def _safe_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [sanitize_summary(item)[:80] for item in value[:12] if str(item).strip()]
