from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.errors import (
    FloodWaitError,
    PhoneCodeExpiredError,
    PhoneCodeInvalidError,
    PhoneNumberInvalidError,
    SessionPasswordNeededError,
)
from telethon.sessions import StringSession
from telethon.tl.types import User, Chat, Channel

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

# 24-hour TTL balances UX (user doesn't re-auth every scan) against security
# (a leaked session token expires in a day).
SESSION_TTL  = int(os.environ.get("TELEGRAM_SESSION_TTL", str(24 * 60 * 60)))
# Demo session storage. This folder is ignored by git.
SESSION_DIR = BACKEND_DIR / "data" / "telegram_sessions"
SESSION_FILE = SESSION_DIR / "sessions.json"

# In-memory session store: phone -> {session, expires_at}
_sessions: dict[str, dict] = {}
# Pending clients waiting for OTP confirmation
_pending: dict[str, dict] = {}
_active_phone: Optional[str] = None


class TelegramConfigError(RuntimeError):
    pass


class TelegramAuthError(RuntimeError):
    def __init__(self, message: str, code: str = "telegram_error"):
        super().__init__(message)
        self.code = code


# ── Persistence helpers ───────────────────────────────────

def _load_sessions() -> None:
    """Load persisted sessions from disk, pruning any that have expired."""
    global _sessions
    try:
        with open(SESSION_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        now = time.time()
        _sessions = {k: v for k, v in data.items() if v.get("expires_at", 0) > now}
    except (FileNotFoundError, json.JSONDecodeError):
        _sessions = {}


def _persist_sessions() -> None:
    """Write current sessions to disk."""
    try:
        SESSION_DIR.mkdir(parents=True, exist_ok=True)
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(_sessions, f)
    except OSError:
        pass


# Load on module import (i.e. on every server start)
_load_sessions()

def _credentials() -> tuple[int, str]:
    raw_api_id = os.environ.get("TELEGRAM_API_ID", "").strip()
    api_hash = os.environ.get("TELEGRAM_API_HASH", "").strip()
    if not raw_api_id or not raw_api_id.isdigit() or not api_hash:
        raise TelegramConfigError(
            "Telegram API credentials are missing. Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in backend/.env"
        )
    return int(raw_api_id), api_hash


def validate_credentials() -> None:
    _credentials()


def _make_client(session_string: str = "") -> TelegramClient:
    api_id, api_hash = _credentials()
    return TelegramClient(StringSession(session_string), api_id, api_hash)


def _normalize_phone(phone: str) -> str:
    cleaned = str(phone or "").strip().replace(" ", "").replace("-", "")
    if not cleaned:
        raise TelegramAuthError("Please enter your Telegram phone number.", "invalid_phone")
    if cleaned.startswith("0"):
        cleaned = "6" + cleaned
    if not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    return cleaned


def _safe_telethon_error(exc: Exception) -> TelegramAuthError:
    if isinstance(exc, TelegramConfigError):
        return TelegramAuthError(str(exc), "missing_credentials")
    if isinstance(exc, PhoneNumberInvalidError):
        return TelegramAuthError("Invalid phone number. Please check the country code and try again.", "invalid_phone")
    if isinstance(exc, PhoneCodeInvalidError):
        return TelegramAuthError("Wrong verification code. Please check the Telegram code and try again.", "wrong_code")
    if isinstance(exc, PhoneCodeExpiredError):
        return TelegramAuthError("The verification code expired. Please request a new code.", "expired_code")
    if isinstance(exc, FloodWaitError):
        seconds = getattr(exc, "seconds", None)
        if seconds:
            return TelegramAuthError(f"Telegram rate limit reached. Please wait {seconds} seconds before trying again.", "flood_wait")
        return TelegramAuthError("Telegram rate limit reached. Please wait before trying again.", "flood_wait")
    return TelegramAuthError("Telegram connection failed. Please try again.", "telegram_error")


async def send_code(phone: str) -> str:
    """Send OTP to the phone number. Returns phone_code_hash."""
    normalized = _normalize_phone(phone)
    try:
        client = _make_client()
        await client.connect()
        result = await client.send_code_request(normalized)
        session_string = client.session.save()
        _pending[normalized] = {
            "client": client,
            "session": session_string,
            "phone_code_hash": result.phone_code_hash,
        }
        return result.phone_code_hash
    except Exception as exc:
        raise _safe_telethon_error(exc) from exc


async def verify_code(phone: str, code: str) -> dict:
    """Verify OTP. Returns {"status": "authenticated"} or {"status": "2fa_required"}."""
    normalized = _normalize_phone(phone)
    entry = _pending.get(normalized)
    if not entry:
        raise TelegramAuthError("No pending login for this phone number. Request a new code.", "no_pending_login")

    client: TelegramClient = entry["client"]
    if not client.is_connected():
        await client.connect()

    try:
        await client.sign_in(normalized, code, phone_code_hash=entry["phone_code_hash"])
    except SessionPasswordNeededError:
        # Telethon raises this when the account has cloud 2FA enabled;
        # we keep the client in _pending so verify_2fa can complete sign-in without a new OTP.
        entry["session"] = client.session.save()
        return {"status": "2fa_required", "success": False, "two_factor_required": True}
    except Exception as exc:
        raise _safe_telethon_error(exc) from exc

    session_string = client.session.save()
    save_session(normalized, session_string)
    await client.disconnect()
    del _pending[normalized]
    return {"status": "authenticated", "success": True}


async def verify_2fa(phone: str, password: str) -> None:
    """Complete sign-in with the user's 2FA cloud password."""
    normalized = _normalize_phone(phone)
    entry = _pending.get(normalized)
    if not entry:
        raise TelegramAuthError("No pending login for this phone number. Request a new code.", "no_pending_login")

    client: TelegramClient = entry["client"]
    if not client.is_connected():
        await client.connect()

    try:
        await client.sign_in(password=password)
    except Exception as exc:
        raise TelegramAuthError("Telegram two-step verification password is incorrect.", "two_factor_failed") from exc
    session_string = client.session.save()
    save_session(normalized, session_string)
    await client.disconnect()
    del _pending[normalized]


async def list_recent_chats(session_string: str, limit: int = 20) -> list[dict]:
    """Return recent dialogs the user can pick to analyse."""
    client = _make_client(session_string)
    await client.connect()
    try:
        dialogs = await client.get_dialogs(limit=limit)
        result = []
        for d in dialogs:
            entity = d.entity
            if isinstance(entity, User):
                name = " ".join(filter(None, [entity.first_name, entity.last_name]))
                kind = "user"
            elif isinstance(entity, (Chat, Channel)):
                name = entity.title
                kind = "group" if isinstance(entity, Chat) else "channel"
            else:
                continue
            result.append({
                "id": str(d.id),
                "name": name or "Unknown",
                "kind": kind,
                "unread": d.unread_count,
            })
        return result
    finally:
        await client.disconnect()


async def fetch_messages(session_string: str, chat_id: int, limit: int = 50) -> list[dict]:
    """Fetch the last `limit` messages from a chat."""
    client = _make_client(session_string)
    await client.connect()
    try:
        messages = []
        async for msg in client.iter_messages(chat_id, limit=limit):
            if not msg.text:
                continue
            sender = "them"
            if msg.out:
                sender = "me"
            messages.append({"sender": sender, "text": msg.text})
        messages.reverse()  # iter_messages returns newest-first; reverse for chronological AI analysis
        return messages
    finally:
        await client.disconnect()


def get_session(phone: str) -> Optional[str]:
    normalized = _normalize_phone(phone)
    entry = _sessions.get(normalized)
    if not entry:
        return None
    if time.time() > entry["expires_at"]:
        del _sessions[normalized]
        _persist_sessions()
        return None
    return entry["session"]


def save_session(phone: str, session_string: str) -> None:
    global _active_phone
    normalized = _normalize_phone(phone)
    _sessions[normalized] = {
        "session": session_string,
        "expires_at": time.time() + SESSION_TTL,
    }
    _active_phone = normalized
    _persist_sessions()


def session_status(phone: str) -> dict:
    global _active_phone
    normalized = _normalize_phone(phone)
    entry = _sessions.get(normalized)
    if not entry:
        return {"authenticated": False}
    remaining = entry["expires_at"] - time.time()
    if remaining <= 0:
        del _sessions[normalized]
        _persist_sessions()
        return {"authenticated": False}
    _active_phone = normalized
    return {"authenticated": True, "expires_in": int(remaining)}


def get_active_session() -> Optional[str]:
    if _active_phone:
        return get_session(_active_phone)
    if len(_sessions) == 1:
        phone = next(iter(_sessions))
        return get_session(phone)
    return None
