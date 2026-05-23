"""
Behavioral Anomaly Engine.

Scores a proposed transfer against the account holder's normal transfer
pattern. Unlike the message-scam engine, this needs NO message at all — it
catches fraud where the victim was social-engineered offline (a phone call,
an in-person con) and there is nothing to scan.

Same philosophy as the risk scoring engine: evidence-based and additive.
A transfer that matches the user's normal behaviour scores 0. Points are
added only for genuine deviations from that baseline.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime


# ── Thresholds ────────────────────────────────────────────
MEDIUM_THRESHOLD = 40   # at/above → medium (advisory warning)
HIGH_THRESHOLD   = 70   # at/above → high


# ── Demo account profile ──────────────────────────────────
# In production this comes from the bank's own transaction history.
# For the demo it is a fixed baseline describing "Nadia Rahman".
DEMO_PROFILE: dict = {
    "balance": 12847.42,
    # Accounts the user has transferred to before — known, trusted payees.
    "known_accounts": {
        "5512309948": "Grab Holdings",
        "7712098855": "Telekom Malaysia",
        "8830561200": "Siti Aminah",
        "6620117734": "Own Savings",
    },
    # The user rarely transfers above this amount — their normal ceiling.
    "typical_transfer_ceiling": 500.0,
}


@dataclass
class BehaviorResult:
    score:           int
    level:           str               # low | medium | high
    anomalies:       list[str] = field(default_factory=list)
    recipient_known: bool = False
    summary:         str = ""


def _parse_amount(amount) -> float:
    if isinstance(amount, (int, float)):
        return float(amount)
    cleaned = re.sub(r"[^0-9.]", "", str(amount or ""))
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0


def analyze_behavior(
    account_number: str = "",
    amount=0,
    hour: int | None = None,
    profile: dict | None = None,
) -> BehaviorResult:
    """Score a proposed transfer against the user's normal behaviour."""
    profile = profile or DEMO_PROFILE
    balance         = float(profile.get("balance", 0) or 0)
    known_accounts  = profile.get("known_accounts", {})
    ceiling         = float(profile.get("typical_transfer_ceiling", 0) or 0)

    acct = re.sub(r"\D", "", account_number or "")
    amt  = _parse_amount(amount)

    score = 0
    anomalies: list[str] = []

    # ── 1. First-time recipient ───────────────────────────
    recipient_known = bool(acct) and acct in known_accounts
    first_time = bool(acct) and not recipient_known
    if first_time:
        score += 25
        anomalies.append("You have never transferred to this account before.")

    # ── 2. Amount spike vs personal baseline ──────────────
    amount_spike = False
    if amt > ceiling and ceiling > 0:
        ratio = amt / ceiling
        if ratio >= 10:
            score += 35
        elif ratio >= 5:
            score += 25
        elif ratio >= 2:
            score += 15
        else:
            score += 8
        amount_spike = ratio >= 2
        anomalies.append(
            f"RM{amt:,.0f} is about {ratio:.0f}x larger than your usual "
            f"transfers (~RM{ceiling:,.0f})."
        )

    # ── 3. Balance drain ──────────────────────────────────
    if balance > 0 and amt > 0:
        pct = amt / balance
        if pct >= 0.8:
            score += 25
            anomalies.append(
                f"This transfer would use {pct * 100:.0f}% of your available balance."
            )
        elif pct >= 0.5:
            score += 15
            anomalies.append(
                f"This transfer would use {pct * 100:.0f}% of your available balance."
            )

    # ── 4. Unusual hour ───────────────────────────────────
    h = hour if hour is not None else datetime.now().hour
    if 0 <= h < 6:
        score += 15
        anomalies.append(
            f"Transfer attempted at an unusual hour ({h:02d}:00–{h:02d}:59)."
        )

    # ── 5. Combo amplifier — the classic scam fingerprint ──
    if first_time and amount_spike:
        score += 15
        anomalies.append(
            "A brand-new recipient combined with an unusually large amount "
            "is a common scam pattern."
        )

    final = min(score, 100)

    if final >= HIGH_THRESHOLD:
        level = "high"
        summary = ("This transfer is very unusual for your account. "
                   "Please pause and verify the recipient before sending.")
    elif final >= MEDIUM_THRESHOLD:
        level = "medium"
        summary = ("This transfer looks different from your normal activity. "
                   "Double-check the recipient before continuing.")
    else:
        level = "low"
        summary = "This transfer matches your normal activity."

    return BehaviorResult(
        score=final,
        level=level,
        anomalies=anomalies,
        recipient_known=recipient_known,
        summary=summary,
    )
