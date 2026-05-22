"""
Hybrid rule-based risk engine.
Takes AI-extracted signals + payment context and produces an explainable risk score.
"""

from dataclasses import dataclass


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
    "purpose_parcel_fee": 10,
    "purpose_job_fee": 12,
    "purpose_investment": 12,
    "purpose_bank_request": 15,
    "recipient_unknown": 8,
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

    source = payment_context.get("requestSource", "")
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


ACTION_GUIDES: dict[str | None, list[str]] = {
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


def get_action_guide(scam_type: str | None) -> list[str]:
    return ACTION_GUIDES.get(scam_type, DEFAULT_GUIDE)


def build_trusted_contact_message(
    recipient: str,
    amount: str,
    scam_type: str | None,
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
