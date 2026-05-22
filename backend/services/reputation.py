"""
Receiver Reputation Scoring Service.

Checks the recipient against known scam patterns, flagged name heuristics,
and a local database that mirrors the structure of BNM/PDRM scam account lists.
Real enforcement data can be dropped into FLAGGED_ACCOUNTS / FLAGGED_KEYWORDS
as it becomes available.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


# ── Flagged account database ─────────────────────────────────────────────────
# Structure mirrors BNM's published mule account format.
# Replace / extend with real data from:
#   - BNM Financial Consumer Alert: bnm.gov.my/financial-consumer-alert
#   - PDRM Commercial Crime Division scam account list
#   - NACSA (National Cyber Security Agency) reported accounts

FLAGGED_ACCOUNTS: set[str] = {
    # Placeholder — add real flagged account numbers here
    "1234567890",
    "0987654321",
}

FLAGGED_PHONE_NUMBERS: set[str] = {
    # Placeholder — add real flagged phone numbers here
    "+60123456789",
}

# Recipient name patterns strongly associated with mule accounts
MULE_NAME_PATTERNS: list[str] = [
    r"\btemporary\b",
    r"\bholding\b",
    r"\bescrow\b",
    r"\bsafe.?account\b",
    r"\bsecure.?account\b",
    r"\bverification.?account\b",
    r"\bclearance.?account\b",
    r"\bgovernment.?account\b",
    r"\bbank.?officer\b",
    r"\blhdn.?account\b",
    r"\bpolis.?account\b",
]

# Source channels known to be heavily abused by scammers
HIGH_RISK_SOURCES: dict[str, int] = {
    "telegram":    8,
    "sms":         5,
    "whatsapp":    4,
    "social_media":8,
    "phone_call":  5,
    # email intentionally excluded — legitimate companies (TNB, Unifi, banks)
    # predominantly use email for billing; penalising it causes false positives
}

# Payment purposes that are almost always scam-associated
SUSPICIOUS_PURPOSES: dict[str, int] = {
    "parcel_fee":    15,
    "parcel fee":    15,
    "job_fee":       15,
    "job fee":       12,
    "bank_request":  15,
    "investment":    12,
    "tax clearance": 15,
    "claim fee":     15,
    "release fee":   15,
}


@dataclass
class ReputationResult:
    score: int                        # 0–25 penalty points
    flags: list[str] = field(default_factory=list)
    is_flagged_account: bool = False


def check_reputation(
    recipient_name: str = "",
    account_number: str = "",
    phone: str = "",
    source: str = "",
    purpose: str = "",
    amount: str = "",
) -> ReputationResult:
    score = 0
    flags: list[str] = []
    is_flagged = False

    name_lower    = recipient_name.lower().strip()
    purpose_lower = purpose.lower().strip()

    # 1. Directly flagged account number
    clean_acc = re.sub(r"\D", "", account_number)
    if clean_acc and clean_acc in FLAGGED_ACCOUNTS:
        score += 25
        flags.append("Recipient account number is on the known scam account list.")
        is_flagged = True

    # 2. Flagged phone number
    clean_phone = re.sub(r"[\s\-\(\)]", "", phone)
    if clean_phone and clean_phone in FLAGGED_PHONE_NUMBERS:
        score += 20
        flags.append("Recipient phone number has been reported as a scam number.")
        is_flagged = True

    # 3. Suspicious recipient name patterns
    for pattern in MULE_NAME_PATTERNS:
        if re.search(pattern, name_lower):
            score += 15
            flags.append(f"Recipient name matches a known mule account pattern: '{recipient_name}'.")
            break

    # 4. High-risk source channel
    src_penalty = HIGH_RISK_SOURCES.get(source.lower(), 0)
    if src_penalty:
        score += src_penalty
        flags.append(f"Request received via {source} — a channel frequently used by scammers.")

    # 5. Suspicious payment purpose
    for kw, pts in SUSPICIOUS_PURPOSES.items():
        if kw in purpose_lower:
            score += pts
            flags.append(f"Payment purpose '{purpose}' is strongly associated with scam patterns.")
            break

    # 6. Round-number large amount from unknown channel (common in scam scripts)
    try:
        amt = float(re.sub(r"[^0-9.]", "", str(amount)) or "0")
        if amt >= 1000 and amt % 100 == 0 and source.lower() in HIGH_RISK_SOURCES:
            score += 5
            flags.append("Round-number large amount requested via high-risk channel.")
    except ValueError:
        pass

    return ReputationResult(
        score=min(score, 25),
        flags=flags,
        is_flagged_account=is_flagged,
    )
