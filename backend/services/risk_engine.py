"""
Rule-based risk engine.

The engine keeps an internal 0-100 risk score, but the user-facing status is
limited to SAFE or UNSAFE.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Optional

from services.app_download_guard import detect_app_download_solicitation
from services.otp_guard import detect_otp_solicitation


SAFE = "SAFE"
UNSAFE = "UNSAFE"
PROCEED_TRANSFER = "PROCEED_TRANSFER"
COOLING_OFF_MODE = "COOLING_OFF_MODE"
SOFT_WARNING_THRESHOLD = 40
UNSAFE_THRESHOLD = 70
SOFT_WARNING_MESSAGE = "This payment has some unusual signs. Please verify the receiver before proceeding."


@dataclass
class RiskResult:
    riskScore: int
    riskStatus: str
    action: str
    scamType: str
    reasons: list[str]
    recommendation: str
    softWarning: dict[str, Any]
    coolingOff: dict[str, Any]
    ruleContributions: dict[str, int]
    appDownloadAlert: dict[str, Any] = None  # type: ignore
    otpAlert: dict[str, Any] = None  # type: ignore

    # Compatibility properties for existing route code
    @property
    def risk_score(self) -> int:
        return self.riskScore

    @property
    def risk_level(self) -> str:
        if self.riskScore >= UNSAFE_THRESHOLD:
            return "high"
        if self.riskScore >= SOFT_WARNING_THRESHOLD:
            return "medium"
        return "low"

    @property
    def risk_status(self) -> str:
        return self.riskStatus

    @property
    def rule_contributions(self) -> dict[str, int]:
        return self.ruleContributions


def analyze_risk(
    receiverName: str = "",
    amount: str | int | float = "",
    purpose: str = "",
    isNewReceiver: bool = False,
    source: str = "",
    message: str = "",
    selectedCallFlags: list[str] | None = None,
) -> RiskResult:
    selectedCallFlags = selectedCallFlags or []
    text = _combine_text(receiverName, amount, purpose, source, message, selectedCallFlags)
    score = 0
    reasons: list[str] = []
    contributions: dict[str, int] = {}

    def add(key: str, points: int, reason: str, condition: bool):
        nonlocal score
        if condition:
            score += points
            contributions[key] = points
            reasons.append(reason)

    # Only 4 rules remain after pruning — each has near-zero false-positive rate in Malaysian context.
    # Ambiguous heuristics (urgency keywords, large amounts, fee requests) were removed because
    # legitimate messages share the same vocabulary; those cases are delegated to AI + ML classifier.

    add(
        "authority_impersonation",
        30,
        "Authority impersonation language detected (police, LHDN, court, government).",
        _contains_any(text, ["police", "lhdn", "court", "sprm", "kastam",
                              "imigresen", "mahkamah", "kerajaan", "pdrm",
                              "bnm", "bank negara", "tax penalty", "cukai",
                              "bank officer", "pegawai bank"]),
    )
    add(
        "threat",
        25,
        "Explicit threat or penalty language detected.",
        _contains_any(text, ["account frozen", "akaun dibekukan", "arrest", "ditahan",
                              "legal action", "tindakan undang", "police case",
                              "kes polis", "deportasi", "rampas", "court case",
                              "penalty", "denda", "suspended", "account suspended"]),
    )
    add(
        "account_verification",
        35,
        "Account suspension or verification request detected.",
        _contains_any(text, ["account suspended", "bank account is suspended",
                              "account verification", "verify your account",
                              "unfreeze your account", "akaun digantung",
                              "akaun dibekukan"]),
    )
    add(
        "suspicious_link",
        35,
        "Suspicious payment link detected in message.",
        # Whitelist covers the most common legitimate Malaysian domains users encounter;
        # any other URL in a payment request is a strong phishing indicator.
        _contains_any(text, ["http://", "https://", "bit.ly", "tinyurl"]) and
        not _contains_any(text, ["maybank2u.com", "cimb.com", "rhbbank.com",
                                 "bankislam.com", "bnm.gov.my", "hasil.gov.my",
                                 "ssm.com.my", "myeg.com.my", "polis.gov.my",
                                 "shopee.com", "lazada.com", "grab.com"]),
    )
    add(
        "urgent_transfer_pressure",
        30,
        "Urgent transfer pressure detected.",
        _contains_any(text, ["transfer now", "send money now", "pay now",
                              "immediately", "urgent", "segera", "within 24 hours"]),
    )
    add(
        "keep_secret",
        25,
        "Request to keep the payment secret detected.",
        _contains_any(text, ["do not tell anyone", "don't tell anyone", "keep secret",
                              "confidential", "jangan beritahu", "rahsia"]),
    )
    add(
        "guaranteed_investment_return",
        45,
        "Guaranteed investment return claim detected.",
        _contains_any(text, ["guaranteed return", "guaranteed investment",
                              "30% in 3 days", "profit guaranteed", "sure profit",
                              "pulangan dijamin"]),
    )
    add(
        "job_upfront_payment",
        40,
        "Job or task offer asks for upfront payment.",
        _contains_any(text, ["job", "work from home", "task", "salary", "recruitment"]) and
        _contains_any(text, ["registration fee", "training fee", "deposit", "upfront", "pay first"]),
    )
    add(
        "parcel_payment_scam",
        35,
        "Parcel or delivery payment scam language detected.",
        _contains_any(text, ["parcel", "delivery", "courier", "customs", "kastam"]) and
        _contains_any(text, ["fee", "tax", "release", "clearance", "pay"]),
    )
    add(
        "third_party_or_mule_transfer",
        35,
        "Third-party or mule-account transfer instruction detected.",
        _contains_any(text, ["third party account", "mule account", "different account",
                              "personal account", "use this account", "akaun keldai"]),
    )
    add(
        "new_receiver",
        20,
        "Recipient is unknown or not previously trusted.",
        bool(isNewReceiver),
    )
    add(
        "unknown_large_transfer",
        35,
        "Unknown recipient with large transfer amount detected.",
        bool(isNewReceiver) and _parse_amount(amount) >= 1000,
    )

    # App install and OTP solicitation each score 70 pts alone — enough to cross
    # the UNSAFE threshold without needing any other signal, because both are absolute
    # indicators of account takeover attempts with no legitimate use case.
    app_download = detect_app_download_solicitation(text)
    # app_name is included in the reason string so the user can see exactly what was detected
    add(
        "app_download_solicitation",
        70,
        f"Caller is asking you to install a remote-access app ({app_download['app_name']}). "
        "Legitimate banks and agencies will NEVER ask this.",
        bool(app_download["detected"]),
    )

    # OTP / TAC solicitation — equally definitive. Real banks, e-wallets and
    # delivery companies will NEVER ask you to read out your one-time code.
    otp = detect_otp_solicitation(text)
    add(
        "otp_solicitation",
        70,
        "Someone is asking you to share a one-time passcode (OTP / TAC). "
        "Real banks and agencies will NEVER ask for this — sharing it lets a "
        "scammer empty your account.",
        bool(otp["detected"]),
    )

    risk_score = min(score, 100)
    risk_status = UNSAFE if risk_score >= UNSAFE_THRESHOLD else SAFE
    action = COOLING_OFF_MODE if risk_status == UNSAFE else PROCEED_TRANSFER
    scam_type = classify_scam_type(text)

    return RiskResult(
        riskScore=risk_score,
        riskStatus=risk_status,
        action=action,
        scamType=scam_type,
        reasons=reasons,
        recommendation=build_recommendation(risk_status, scam_type),
        softWarning=build_soft_warning(risk_score),
        coolingOff=build_cooling_off(risk_status),
        ruleContributions=contributions,
        appDownloadAlert=app_download,
        otpAlert=otp,
    )


def calculate_risk(ai_result: dict, payment_context: dict) -> RiskResult:
    """
    Compatibility wrapper for existing route code.
    Delegates to analyze_risk so all logic stays in one place.
    """
    message = ai_result.get("message") or payment_context.get("message", "")
    return analyze_risk(
        receiverName=payment_context.get("receiverName") or payment_context.get("recipient", ""),
        amount=payment_context.get("amount", ""),
        purpose=payment_context.get("purpose") or payment_context.get("paymentPurpose", ""),
        isNewReceiver=_is_new_receiver(payment_context),
        source=payment_context.get("source") or payment_context.get("requestSource", ""),
        message=message,
        selectedCallFlags=ai_result.get("selectedCallFlags") or payment_context.get("selectedCallFlags", []),
    )


ACTION_GUIDES: dict[Optional[str], list] = {
    "Authority Impersonation Scam": [
        "Do not transfer money to verify or unfreeze an account.",
        "Call the organisation directly using a number from its official website.",
        "Do not share OTP, TAC, passwords, or banking credentials.",
        "If you already paid, call your bank immediately and dial NSRC 997.",
    ],
    "Parcel / Delivery Scam": [
        "Do not click delivery links from messages.",
        "Track your parcel directly on the official courier website.",
        "Legitimate couriers do not ask for payment through unknown links.",
        "If you already paid, call your bank immediately and dial NSRC 997.",
    ],
    "Investment Scam": [
        "Check whether the platform is registered with SC Malaysia.",
        "Guaranteed high returns are a classic scam signal.",
        "Do not send more money to unlock withdrawals.",
        "If you already paid, call your bank immediately and dial NSRC 997.",
    ],
    "Fake Job Scam": [
        "Legitimate employers do not charge registration or training fees.",
        "Verify the company through official business records before paying.",
        "Do not share your bank account or MyKad details.",
        "Report suspicious job offers through official complaint channels.",
    ],
    "Banking / Phishing Scam": [
        "Your real bank will NEVER ask you to transfer money to verify your account.",
        "Close the chat and call your bank directly using the number on your card.",
        "Do not provide OTP, TAC, passwords, or login details.",
        "If you shared credentials, change them immediately and call the bank hotline.",
    ],
    "Prize / Reward Scam": [
        "Do not pay claim fees to receive a prize.",
        "Verify the campaign through the official company website.",
        "Do not share banking or identity details with the sender.",
    ],
    "Emergency / Family Scam": [
        "Call the person directly using a saved number before paying.",
        "Ask a trusted family member to verify the emergency.",
        "Do not rush a transfer based only on a message.",
    ],
    "No specific scam type detected": [
        "Proceed only if you trust the receiver and understand the payment purpose.",
        "Verify unusual requests through an official channel before paying.",
    ],
    None: [
        "Do not proceed until you have verified the request through an official channel.",
        "Contact the relevant organisation directly using a number from their official website.",
        "If money has already been transferred, call NSRC 997 immediately.",
    ],
}

DEFAULT_GUIDE = ACTION_GUIDES[None]


def get_action_guide(scam_type: Optional[str]) -> list:
    return ACTION_GUIDES.get(scam_type, DEFAULT_GUIDE)


def build_trusted_contact_message(
    recipient: str,
    amount: str,
    scam_type: Optional[str],
    risk_level: str = "",
    risk_status: str = "",
    message_snippet: str = "",
) -> str:
    status = risk_status or risk_level or "Unknown"
    return (
        f"Hi, I need a second opinion before I make a payment.\n\n"
        f"I received a message asking me to transfer RM {amount} to \"{recipient}\".\n"
        f"The message snippet: \"{message_snippet[:150]}{'...' if len(message_snippet) > 150 else ''}\"\n\n"
        f"JagaDuit AI flagged this as: {scam_type or 'Potentially suspicious'}\n"
        f"Risk status: {status}\n\n"
        f"Can you help me verify if this is legitimate before I pay?\n\n"
        f"-- Checked with JagaDuit AI"
    )


def classify_scam_type(text: str) -> str:
    if _contains_any(text, ["police", "bank", "lhdn", "court", "government", "kerajaan"]):
        return "Authority Impersonation Scam"
    if _contains_any(text, ["parcel", "delivery", "customs", "courier", "shipping"]):
        return "Parcel / Delivery Scam"
    if _contains_any(text, ["investment", "profit", "crypto", "return", "guaranteed"]):
        return "Investment Scam"
    if _contains_any(text, ["job", "salary", "recruitment", "registration fee", "training fee"]):
        return "Fake Job Scam"
    if _contains_any(text, ["otp", "password", "account verification", "login", "suspicious link"]):
        return "Banking / Phishing Scam"
    if _contains_any(text, ["winner", "prize", "iphone", "reward", "claim fee"]):
        return "Prize / Reward Scam"
    if _contains_any(text, ["emergency", "hospital", "accident", "help me", "family"]):
        return "Emergency / Family Scam"
    return "No specific scam type detected"


def build_recommendation(risk_status: str, scam_type: str) -> str:
    if risk_status == SAFE:
        return "Safety Check Passed. You may proceed, but verify the receiver if anything feels unusual."
    return (
        f"Cooling-Off Mode Activated. This looks like {scam_type}. "
        "Pause, verify through an official channel, and do not transfer until you are certain."
    )


def build_soft_warning(risk_score: int) -> dict[str, Any]:
    enabled = SOFT_WARNING_THRESHOLD <= risk_score < UNSAFE_THRESHOLD
    return {
        "enabled": enabled,
        "message": SOFT_WARNING_MESSAGE if enabled else "",
    }


def build_cooling_off(risk_status: str) -> dict[str, Any]:
    if risk_status == UNSAFE:
        return {
            "enabled": True,
            "durationSeconds": 30,
            "message": "Cooling-Off Mode Activated. Please wait 30 seconds and verify before proceeding.",
        }
    return {
        "enabled": False,
        "durationSeconds": 0,
        "message": "Safety Check Passed.",
    }


def _combine_text(*values: Any) -> str:
    parts: list[str] = []
    for value in values:
        if isinstance(value, list):
            parts.extend(str(item) for item in value)
        else:
            parts.append(str(value))
    return " ".join(parts).lower()


def _contains_any(text: str, needles: list[str]) -> bool:
    return any(needle.lower() in text for needle in needles)


def _parse_amount(amount: str | int | float) -> float:
    if isinstance(amount, (int, float)):
        return float(amount)
    cleaned = re.sub(r"[^0-9.]", "", str(amount))
    if not cleaned:
        return 0
    try:
        return float(cleaned)
    except ValueError:
        return 0


def _looks_official(value: str) -> bool:
    return _contains_any(
        value.lower(),
        ["official", "government", "kerajaan", "lhdn", "court", "police",
         "bank", "tax", "customs", "verification"],
    )


def _looks_like_personal_name(value: str) -> bool:
    cleaned = re.sub(r"[^A-Za-z ]", "", value).strip()
    if not cleaned:
        return False
    words = cleaned.split()
    organisation_terms = {"sdn", "bhd", "berhad", "bank", "lhdn", "pos",
                          "courier", "delivery", "company", "enterprise"}
    return len(words) >= 2 and not any(word.lower() in organisation_terms for word in words)


def _is_new_receiver(payment_context: dict) -> bool:
    if payment_context.get("isNewReceiver") is not None:
        return bool(payment_context["isNewReceiver"])
    if payment_context.get("is_new_receiver") is not None:
        return bool(payment_context["is_new_receiver"])
    return payment_context.get("recipientType") in {"unknown", ""}
