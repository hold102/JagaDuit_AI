"""
OTP / TAC Solicitation Guard.

Detects when someone is steering the user to reveal a one-time passcode —
the exact moment an account takeover happens. Pattern-based and instant: no
AI round-trip, because an interruption must fire the moment the words are
spoken, not seconds later.

This is a deliberately high-precision signal. A legitimate bank, e-wallet, or
delivery company will NEVER ask you to read out your OTP/TAC. So when a request
for the code is detected, it is almost always an account-takeover attempt.

Detection logic: a "code term" (OTP, TAC, verification code, ...) appearing
close to a "solicit term" (give, send, tell, what is, ...). Negated solicit
verbs ("do not share", "jangan beri") are ignored so safety advice does not
trigger a false alarm. English and Bahasa Malaysia are both covered.
"""

from __future__ import annotations

import re


# ── Words for the secret code itself ──────────────────────
# Note: browser speech recognition often transcribes acronyms with spaces
# (e.g. "O T P", "T A C") so the patterns accept that form too.
# Patterns accept spaced forms like "O T P" and "T A C" because the Web Speech API
# often transcribes acronyms letter-by-letter during live call monitoring.
_CODE_RE = re.compile(
    r"(?:\b|^)("
    r"o[\s\.\-]?t[\s\.\-]?p|"
    r"t[\s\.\-]?a[\s\.\-]?c|"
    r"one[\s-]?time\s*(?:password|passcode|pass|code)|"
    r"verification\s*code|security\s*code|sms\s*code|auth(?:orisation)?\s*code|"
    r"\d?\s*\d[\s-]?digit\s*(?:code|number|pin)|"
    r"kod\s*(?:pengesahan|keselamatan|tac|otp|sms)|"
    r"nombor\s*(?:tac|pengesahan)"
    r")(?:\b|$)",
    re.I,
)

# ── Verbs/phrases that mean "hand the code over" ──────────
_SOLICIT_RE = re.compile(
    r"\b("
    r"give|send|share|tell|read|provide|forward|confirm|repeat|verify|"
    r"key[\s-]?in|enter|type|what'?s|what\s+is|need|want|"
    r"berikan|beri|bagi|hantar|kongsi|baca|nyatakan|berapa|masukkan|sebut"
    r")\b",
    re.I,
)

# ── Negations that flip a request into safety advice ──────
_NEG_RE = re.compile(
    r"\b(do\s*not|don'?t|never|won'?t|will\s*not|cannot|can'?t|"
    r"jangan|tidak|tak)\b",
    re.I,
)

# 55-char proximity window ≈ one short sentence — wide enough to catch
# "please give me your OTP" but tight enough to avoid cross-sentence false positives.
_PROXIMITY = 55
# 22-char negation window covers "do not", "don't", "jangan" immediately before the verb
_NEG_WINDOW = 22

_WARNING = (
    "Someone on this call is asking you to share a one-time passcode "
    "(OTP / TAC). Never share it. Your bank, e-wallet, or any real company "
    "will NEVER ask for your OTP — sharing it lets a scammer empty your "
    "account in seconds."
)


def _none() -> dict:
    return {"detected": False, "matched_text": "", "message": ""}


def detect_otp_solicitation(text: str) -> dict:
    """Return {detected, matched_text, message} for OTP/TAC solicitation."""
    if not text or not text.strip():
        return _none()

    low = text.lower()

    code_spans = [m.span() for m in _CODE_RE.finditer(low)]
    if not code_spans:
        return _none()

    solicit_spans = [m.span() for m in _SOLICIT_RE.finditer(low)]
    if not solicit_spans:
        return _none()

    neg_spans = [m.span() for m in _NEG_RE.finditer(low)]

    for s0, s1 in solicit_spans:
        # Skip a solicit verb that is negated ("do not share", "jangan beri").
        if any(0 <= s0 - n1 <= _NEG_WINDOW for _, n1 in neg_spans):
            continue
        for c0, c1 in code_spans:
            gap = c0 - s1 if c0 >= s1 else s0 - c1
            if gap <= _PROXIMITY:
                lo = max(0, min(s0, c0) - 12)
                hi = min(len(text), max(s1, c1) + 12)
                return {
                    "detected": True,
                    "matched_text": text[lo:hi].strip(),
                    "message": _WARNING,
                }

    return _none()
