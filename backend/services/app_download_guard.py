"""
App-Download Solicitation Guard.

Detects when someone on a call is steering the user to install a remote-access
or screen-sharing app — the standard playbook for tech-support and bank-fraud
scams. A legitimate bank, government agency, or delivery company will NEVER
ask you to install a third-party app to "verify" or "secure" your account.

Detection logic mirrors otp_guard: a "solicit verb" (download, install, get,
pasang, muat turun) appearing close to an "app term" (a known remote-access
app name OR a generic application reference). Negated solicit verbs
("do not install", "jangan muat turun") are ignored so safety advice does
not trigger a false alarm. English and Bahasa Malaysia are both covered.
"""

from __future__ import annotations

import re


# ── Known remote-access / screen-sharing app names ────────
# These are the apps most abused in Malaysian scam playbooks.
_APP_NAMES = [
    r"anydesk",
    r"teamviewer",
    r"quick\s*assist",
    r"rustdesk",
    r"chrome\s*remote\s*desktop",
    r"zoho\s*assist",
    r"splashtop",
    r"screenconnect",
    r"connectwise",
    r"logmein",
    r"gotoassist",
    r"supremo",
    r"aeroadmin",
    r"ultraviewer",
    r"mikogo",
    r"showmypc",
    r"airdroid",
    r"vysor",
]

# ── Generic application / remote-access references ────────
_GENERIC_APP_TERMS = [
    r"this\s*app(?:lication)?",
    r"the\s*app(?:lication)?",
    r"our\s*app(?:lication)?",
    r"support\s*app",
    r"helper\s*app",
    r"remote\s*(?:access|control|app|software|tool)",
    r"screen[\s-]?shar(?:e|ing)",
    r"share\s*(?:your|my)\s*screen",
    r"control\s*(?:your|my)\s*phone",
    r"aplikasi(?:\s*ini|\s*kami)?",
    r"perisian\s*(?:jauh|kawalan)",
    r"kongsi\s*skrin",
    r"kawalan\s*jauh",
]

_APP_RE = re.compile(
    r"\b(" + "|".join(_APP_NAMES + _GENERIC_APP_TERMS) + r")\b",
    re.I,
)

# ── Verbs that mean "put this app on your device" ─────────
_SOLICIT_RE = re.compile(
    r"\b("
    r"download|install|get|setup|set\s*up|add|open|launch|run|use|"
    r"muat\s*turun|pasang|dapatkan|buka|guna(?:kan)?"
    r")\b",
    re.I,
)

# ── Negations that flip a request into safety advice ──────
_NEG_RE = re.compile(
    r"\b(do\s*not|don'?t|never|won'?t|will\s*not|cannot|can'?t|"
    r"jangan|tidak|tak)\b",
    re.I,
)

# ── Prior-install context that cancels a solicit verb ─────
# "You already have TeamViewer installed", "I previously installed AnyDesk",
# "sudah ada aplikasi ini" — past-tense framing, not a scam request.
_PRIOR_INSTALL_RE = re.compile(
    r"\b(already|previously|last\s*time|earlier|sudah|dah)\b",
    re.I,
)

# 60-char window is wider than otp_guard (55) because app names can appear at the end
# of longer instructions ("please go ahead and download AnyDesk from the app store").
_PROXIMITY = 60
# 22-char negation window covers "do not", "don't", "jangan" immediately before the verb
_NEG_WINDOW = 22
# Prior-install window is generous because "already have AnyDesk installed" spans many words
_PRIOR_WINDOW = 50

_WARNING = (
    "Someone on this call is asking you to install a remote-access or "
    "screen-sharing app. No real bank, government agency, or delivery "
    "company will ever ask you to do this. Installing the app lets a "
    "scammer watch your screen — including your OTP — and drain your "
    "account. End the call now and do NOT install anything."
)


def _none() -> dict:
    return {"detected": False, "matched_text": "", "app_name": "", "message": ""}


def detect_app_download_solicitation(text: str) -> dict:
    """Return {detected, matched_text, app_name, message} for app-install solicitation."""
    if not text or not text.strip():
        return _none()

    low = text.lower()

    app_spans = [(m.span(), m.group(0)) for m in _APP_RE.finditer(low)]
    if not app_spans:
        return _none()

    solicit_spans = [m.span() for m in _SOLICIT_RE.finditer(low)]
    if not solicit_spans:
        return _none()

    neg_spans = [m.span() for m in _NEG_RE.finditer(low)]
    prior_spans = [m.span() for m in _PRIOR_INSTALL_RE.finditer(low)]

    for s0, s1 in solicit_spans:
        # Skip a solicit verb that is negated ("do not install", "jangan pasang").
        if any(0 <= s0 - n1 <= _NEG_WINDOW for _, n1 in neg_spans):
            continue
        for (a0, a1), app_name in app_spans:
            # Skip if a prior-install marker sits near the app term
            # ("already have AnyDesk", "sudah pasang aplikasi").
            if any(abs(p0 - a0) <= _PRIOR_WINDOW or abs(p1 - a1) <= _PRIOR_WINDOW
                   for p0, p1 in prior_spans):
                continue
            gap = a0 - s1 if a0 >= s1 else s0 - a1
            if gap <= _PROXIMITY:
                lo = max(0, min(s0, a0) - 12)
                hi = min(len(text), max(s1, a1) + 12)
                return {
                    "detected": True,
                    "matched_text": text[lo:hi].strip(),
                    "app_name": app_name.strip(),
                    "message": _WARNING,
                }

    return _none()
