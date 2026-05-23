"""
Dynamic Scoring Engine.

Replaces the fixed '+40 AI cap' with a signal-agreement weighting system:

  - When multiple signals agree a message is risky → each signal gets amplified
  - When signals disagree → they moderate each other (prevents single-signal false positives)
  - AI confidence dynamically adjusts how much the AI can contribute
  - Flagged accounts can override the threshold entirely

Signal sources:
  1. Rule engine     (0–100) — deterministic keyword rules
  2. DeepSeek AI     (0–60)  — semantic understanding
  3. ML Classifier   (0–1)   — trained on Malaysian scam data
  4. Reputation      (0–25)  — receiver/source/purpose reputation
"""

from __future__ import annotations

from dataclasses import dataclass, field


# ── Thresholds ────────────────────────────────────────────
SAFE_THRESHOLD    = 40
UNSAFE_THRESHOLD  = 70


@dataclass
class DynamicScore:
    final_score:         int
    risk_level:          str          # low | medium | high
    risk_status:         str          # SAFE | UNSAFE
    action:              str          # PROCEED_TRANSFER | COOLING_OFF_MODE
    signal_breakdown:    dict[str, float] = field(default_factory=dict)
    agreement_bonus:     int = 0
    override_applied:    bool = False
    override_reason:     str = ""


def compute(
    rule_score:        int,
    ai_risk_contrib:   int,       # 0–60 from DeepSeek
    classifier_prob:   float,     # 0.0–1.0 from ML classifier
    reputation_score:  int,       # 0–25 from reputation service
    is_flagged_account: bool = False,
) -> DynamicScore:
    """
    Combine all four signals into a final risk score using dynamic weighting.
    """

    # ── Hard override: flagged account ────────────────────
    if is_flagged_account:
        return DynamicScore(
            final_score=100,
            risk_level="high",
            risk_status="UNSAFE",
            action="COOLING_OFF_MODE",
            signal_breakdown={"flagged_account_override": 100},
            override_applied=True,
            override_reason="Recipient account is on the known scam account list.",
        )

    # ── Normalise each signal to 0.0–1.0 ─────────────────
    rule_norm       = rule_score      / 100
    ai_norm         = ai_risk_contrib / 60
    classifier_norm = classifier_prob           # already 0–1
    rep_norm        = reputation_score / 25

    # ── Signal agreement score (0.0–1.0) ─────────────────
    # Average of all four normalised signals.
    # High agreement → all signals point the same way → amplify.
    agreement = (rule_norm + ai_norm + classifier_norm + rep_norm) / 4

    # ── Dynamic AI weight ─────────────────────────────────
    # Low AI confidence  → AI gets less influence (rules dominate)
    # High AI confidence → AI can push past the old +40 cap
    if ai_norm >= 0.75:
        ai_weight = 1.0   # AI very confident — trust it fully
    elif ai_norm >= 0.50:
        ai_weight = 0.85
    elif ai_norm >= 0.25:
        ai_weight = 0.65
    else:
        ai_weight = 0.40  # AI uncertain — defer to rules

    # ── Dynamic rule weight ───────────────────────────────
    # If rules fire strongly AND AI agrees → amplify rules slightly
    if rule_norm >= 0.60 and agreement >= 0.55:
        rule_weight = 1.10
    elif rule_norm >= 0.40:
        rule_weight = 1.0
    else:
        rule_weight = 0.90  # Low rule score → slight discount

    # ── Per-signal point contributions ───────────────────
    rule_pts       = rule_score * rule_weight
    ai_pts         = ai_risk_contrib * ai_weight
    classifier_pts = classifier_prob * 30          # 0–30
    rep_pts        = reputation_score              # 0–25

    # ── Agreement bonus ───────────────────────────────────
    # All four signals pointing high → extra confidence boost
    if agreement >= 0.70:
        bonus = 12
    elif agreement >= 0.55:
        bonus = 7
    elif agreement >= 0.40:
        bonus = 3
    else:
        bonus = 0

    # ── Disagreement dampener ─────────────────────────────
    # Rules say safe but AI says scam (or vice versa) → reduce AI weight
    # This prevents a single overconfident signal from causing a false positive
    if rule_norm < 0.20 and ai_norm >= 0.70:
        # AI very confident but rules found nothing — dampen slightly
        ai_pts *= 0.75
        bonus = max(bonus - 5, 0)
    elif rule_norm >= 0.60 and ai_norm < 0.20:
        # Rules fired strongly but AI sees nothing — dampen rules slightly
        rule_pts *= 0.85

    raw_total = rule_pts + ai_pts + classifier_pts + rep_pts + bonus
    final = min(round(raw_total), 100)

    # ── Derive level ──────────────────────────────────────
    if final >= UNSAFE_THRESHOLD:
        level, status, action = "high", "UNSAFE", "COOLING_OFF_MODE"
    elif final >= SAFE_THRESHOLD:
        level, status, action = "medium", "SAFE", "PROCEED_TRANSFER"
    else:
        level, status, action = "low", "SAFE", "PROCEED_TRANSFER"

    return DynamicScore(
        final_score=final,
        risk_level=level,
        risk_status=status,
        action=action,
        agreement_bonus=bonus,
        signal_breakdown={
            "rule_engine":      round(rule_pts),
            "deepseek_ai":      round(ai_pts),
            "ml_classifier":    round(classifier_pts),
            "reputation":       rep_pts,
            "agreement_bonus":  bonus,
            "agreement_index":  round(agreement, 2),
        },
    )
