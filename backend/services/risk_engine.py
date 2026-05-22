"""
Hybrid rule-based risk engine.
Takes AI-extracted signals + payment context and produces an explainable risk score.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


RULE_WEIGHTS = {
    # AI signals
    "emotional_pressure": 10,
    "impersonation_detected": 15,
    "suspicious_link": 15,
    # Payment context
    "urgency_medium": 5,
    "urgency_high": 15,
    "source_sms": 5,
    "source_whatsapp": 3,
    "source_telegram": 5,
    "source_email": 3,
    "source_messenger": 4,
    "source_instagram_dm": 4,
    "source_phone_call": 8,
    "source_facebook_marketplace": 7,
    "source_other": 4,
    "purpose_parcel_fee": 10,
    "purpose_job_fee": 12,
    "purpose_investment": 12,
    "purpose_bank_request": 15,
    "recipient_unknown": 8,
}

SOURCE_RULES = {
    "whatsapp": [
        ("Family or friend impersonation language detected.", 18, ["mum", "dad", "brother", "sister", "friend", "new number", "lost phone"]),
        ("Urgent transfer request detected.", 18, ["urgent", "now", "immediately", "today", "asap"]),
        ("Fake investment group signal detected.", 16, ["investment", "crypto", "profit", "trading group", "guaranteed return"]),
        ("Suspicious link detected.", 14, ["http", "bit.ly", "tinyurl", ".com"]),
        ("Secrecy request detected.", 16, ["do not tell", "don't tell", "secret", "confidential"]),
        ("Unknown or mule account request detected.", 18, ["another account", "personal account", "mule", "third party account"]),
    ],
    "sms": [
        ("Fake bank or government alert detected.", 18, ["bank", "lhdn", "pdrm", "court", "government", "kerajaan"]),
        ("OTP or credential request detected.", 20, ["otp", "tac", "pin", "password"]),
        ("Fake delivery fee signal detected.", 16, ["parcel", "delivery", "courier", "shipping fee"]),
        ("Short suspicious link detected.", 14, ["bit.ly", "tinyurl", "http", ".xyz"]),
        ("Urgent account verification language detected.", 18, ["verify", "account blocked", "account frozen", "within 24 hours"]),
    ],
    "email": [
        ("Phishing language detected.", 16, ["verify your account", "login", "password", "security alert"]),
        ("Fake invoice or payment request detected.", 16, ["invoice", "payment due", "bank details", "remittance"]),
        ("Fake job or scholarship offer detected.", 15, ["job offer", "scholarship", "registration fee", "processing fee"]),
        ("Suspicious sender, attachment, or link risk detected.", 14, ["attachment", "download", "http", ".zip", ".exe"]),
        ("Urgent payment request detected.", 16, ["urgent payment", "pay now", "overdue", "immediately"]),
    ],
    "messenger_facebook": [
        ("Impersonation or romance scam signal detected.", 18, ["friend", "profile", "love", "romance", "emergency"]),
        ("Fake giveaway or reward signal detected.", 14, ["giveaway", "winner", "prize", "claim"]),
        ("Marketplace buyer or seller scam signal detected.", 18, ["deposit", "marketplace", "buyer", "seller", "courier"]),
        ("Fake proof of payment detected.", 16, ["proof of payment", "receipt", "paid already"]),
        ("Payment outside platform requested.", 16, ["outside platform", "bank transfer", "personal account"]),
        ("Urgent transfer request detected.", 14, ["urgent", "now", "fast", "today"]),
    ],
    "instagram_dm": [
        ("Impersonation or romance scam signal detected.", 18, ["impersonate", "new account", "love", "relationship", "emergency"]),
        ("Fake giveaway signal detected.", 14, ["giveaway", "winner", "prize", "claim"]),
        ("Fake investment or trading offer detected.", 18, ["investment", "trading", "crypto", "profit", "forex"]),
        ("Suspicious link detected.", 14, ["http", "bit.ly", "link in bio", ".com"]),
        ("Urgent payment request detected.", 14, ["urgent", "now", "send money", "transfer"]),
    ],
    "other": [
        ("Urgency pressure detected.", 14, ["urgent", "now", "immediately", "today"]),
        ("Secrecy request detected.", 14, ["do not tell", "don't tell", "secret", "confidential"]),
        ("Suspicious link detected.", 12, ["http", "bit.ly", "tinyurl", ".com"]),
        ("Money transfer request detected.", 16, ["transfer", "bank in", "send money", "deposit"]),
        ("Request for OTP, password, bank details, or personal information detected.", 18, ["otp", "password", "bank details", "ic number", "mykad", "pin"]),
    ],
    "phone_call": [
        ("Urgency or pressure to act immediately detected.", 18, ["urgent", "now", "immediately", "today", "act fast", "right now"]),
        ("Threat or fear-based pressure detected.", 18, ["arrest", "court", "legal action", "fine", "police report", "warrant"]),
        ("Authority impersonation detected.", 20, ["police", "bank", "lhdn", "court", "government", "bnm", "officer"]),
        ("Secrecy request detected.", 18, ["do not tell", "don't tell", "keep this secret", "confidential", "do not contact"]),
        ("Immediate money transfer request detected.", 20, ["transfer", "send money", "bank in", "deposit", "personal account"]),
        ("Request for OTP, password, bank details, or personal information detected.", 20, ["otp", "tac", "pin", "password", "bank details", "ic number", "mykad"]),
        ("Remote access request detected.", 18, ["anydesk", "teamviewer", "remote access", "install app", "screen share"]),
        ("Instruction not to verify with family, bank, or official support detected.", 18, ["do not call", "do not contact", "don't contact family", "don't call bank", "avoid the branch"]),
        ("Account freeze threat detected.", 18, ["account frozen", "account freeze", "blocked account", "freeze your account"]),
    ],
}


@dataclass
class RiskResult:
    risk_score: int          # 0-100
    risk_level: str          # low | medium | high
    rule_contributions: dict


def calculate_risk(ai_result: dict, payment_context: dict) -> RiskResult:
    score = ai_result.get("ai_risk_contribution", 0)
    contributions: dict[str, int] = {"ai_message_analysis": score}

    def add(key: str, condition: bool):
        if condition:
            w = RULE_WEIGHTS.get(key, 0)
            contributions[key] = w
            return w
        return 0

    score += add("emotional_pressure", ai_result.get("emotional_pressure", False))
    score += add("impersonation_detected", ai_result.get("impersonation_detected", False))
    score += add("suspicious_link", ai_result.get("suspicious_link", False))

    urgency = payment_context.get("urgency", "")
    score += add("urgency_medium", urgency == "medium")
    score += add("urgency_high", urgency == "high")

    source = payment_context.get("evidenceSource") or payment_context.get("requestSource", "")
    score += add(f"source_{source}", source in RULE_WEIGHTS)

    purpose = payment_context.get("paymentPurpose", "")
    score += add(f"purpose_{purpose}", f"purpose_{purpose}" in RULE_WEIGHTS)

    rec_type = payment_context.get("recipientType", "")
    score += add("recipient_unknown", rec_type == "unknown")

    score = min(score, 100)

    if score < 35:
        level = "low"
    elif score < 65:
        level = "medium"
    else:
        level = "high"

    return RiskResult(risk_score=score, risk_level=level, rule_contributions=contributions)


def analyze_chat_evidence(
    evidence_source: str,
    message_text: str,
    amount: str = "",
    recipient_name: str = "",
    recipient_account: str = "",
    payment_context: str = "transfer_before_payment",
) -> dict:
    source = evidence_source if evidence_source in SOURCE_RULES else "other"
    text = " ".join([message_text, amount, recipient_name, recipient_account, payment_context]).lower()
    score = 0
    reasons: list[str] = []
    contributions: dict[str, int] = {}

    for reason, points, needles in SOURCE_RULES[source]:
        if any(needle in text for needle in needles):
            score += points
            reasons.append(reason)
            contributions[reason] = points

    if amount:
        try:
            numeric_amount = float("".join(ch for ch in str(amount) if ch.isdigit() or ch == ".") or 0)
        except ValueError:
            numeric_amount = 0
        if numeric_amount >= 500:
            score += 10
            reasons.append("Transfer amount is RM 500 or above.")
            contributions["large_amount"] = 10

    if recipient_account and any(term in text for term in ["unknown", "personal account", "third party"]):
        score += 10
        reasons.append("Payment appears linked to an unknown or third-party account.")
        contributions["unknown_account"] = 10

    score = min(score, 100)
    if score < 35:
        risk_level = "SAFE"
        legacy_level = "low"
        recommended_action = "No major scam pattern detected. Continue only if the receiver and purpose are verified."
    elif score < 70:
        risk_level = "CAUTION"
        legacy_level = "medium"
        recommended_action = "Pause and verify the request through an official or trusted channel before transferring."
    else:
        risk_level = "DANGER"
        legacy_level = "high"
        recommended_action = "Do not transfer. This evidence has strong scam indicators."

    if not reasons:
        reasons.append("No strong scam indicators found in the provided evidence.")

    return {
        "riskLevel": risk_level,
        "score": score,
        "reasons": reasons,
        "recommendedAction": recommended_action,
        "risk_level": legacy_level,
        "risk_score": score,
        "red_flags": reasons,
        "scam_type": _chat_scam_type(source, text),
        "rule_contributions": {"ai_message_analysis": score, **contributions},
        "action_guide": get_action_guide(None),
    }


def analyze_call_summary(
    transcript: str,
    amount: str = "",
    recipient_name: str = "",
    recipient_account: str = "",
    payment_context: str = "transfer_before_payment",
    input_mode: str = "typed_summary",
) -> dict:
    result = analyze_chat_evidence(
        evidence_source="phone_call",
        message_text=transcript,
        amount=amount,
        recipient_name=recipient_name,
        recipient_account=recipient_account,
        payment_context=payment_context,
    )
    result["inputMode"] = input_mode
    result["evidenceSource"] = "phone_call"
    return result


def _chat_scam_type(source: str, text: str) -> str:
    if any(term in text for term in ["bank", "otp", "password", "verify account", "account frozen"]):
        return "Bank Freeze / Account Verification"
    if any(term in text for term in ["parcel", "delivery", "courier"]):
        return "Parcel Fee Scam"
    if any(term in text for term in ["investment", "crypto", "trading", "profit"]):
        return "Investment Scam"
    if any(term in text for term in ["job", "scholarship", "registration fee"]):
        return "Fake Job Offer"
    if source == "messenger_facebook" and any(term in text for term in ["marketplace", "deposit", "seller", "buyer"]):
        return "Marketplace Scam"
    return "Potential Scam"


ACTION_GUIDES: dict[Optional[str], list] = {
    "Parcel Fee Scam": [
        "Do not click any links in the message.",
        "Track your parcel directly on the official Pos Malaysia or courier website.",
        "Legitimate couriers do not ask for payment via WhatsApp or SMS.",
        "If you already paid, call your bank immediately and dial NSRC 997.",
    ],
    "Fake Job Offer": [
        "Legitimate employers do not charge registration or training fees.",
        "Verify the company through SSM (ssm.com.my) before any payment.",
        "Do not share your bank account or MyKad details.",
        "Report suspicious job offers to MCMC aduan.skmm.gov.my.",
    ],
    "Investment Scam": [
        "Check if the platform is registered with SC Malaysia (sc.com.my).",
        "Guaranteed high returns are a classic scam signal — do not invest.",
        "Withdraw any funds you already deposited and contact your bank.",
        "File a report with SC or PDRM's Cyber Crime Division.",
    ],
    "Bank Freeze / Account Verification": [
        "Your real bank will NEVER ask you to transfer money to verify your account.",
        "Hang up / close the chat and call your bank directly using the number on your card.",
        "Do not provide OTP, TAC, or passwords to anyone.",
        "If you shared credentials, change them immediately and call the bank hotline.",
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
    risk_level: str,
    message_snippet: str,
) -> str:
    risk_label = {"low": "Low", "medium": "Medium ⚠️", "high": "High 🚨"}.get(risk_level, "Unknown")
    return (
        f"Hi, I need a second opinion before I make a payment.\n\n"
        f"I received a message asking me to transfer RM {amount} to \"{recipient}\".\n"
        f"The message snippet: \"{message_snippet[:150]}{'…' if len(message_snippet) > 150 else ''}\"\n\n"
        f"JagaDuit AI flagged this as: {scam_type or 'Potentially suspicious'}\n"
        f"Risk level: {risk_label}\n\n"
        f"Can you help me verify if this is legitimate before I pay?\n\n"
        f"— Checked with JagaDuit AI (jagaduit.ai)"
    )
