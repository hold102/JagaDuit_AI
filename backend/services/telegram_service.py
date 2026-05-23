from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Optional

from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession
from telethon.tl.types import User, Chat, Channel

SESSION_TTL  = int(os.environ.get("TELEGRAM_SESSION_TTL", str(24 * 60 * 60)))  # default 24 h
SESSION_FILE = os.path.join(os.path.dirname(__file__), "..", "tg_sessions.json")

# In-memory session store: phone -> {session, expires_at}
_sessions: dict[str, dict] = {}
# Pending clients waiting for OTP confirmation
_pending: dict[str, dict] = {}


# ── Persistence helpers ───────────────────────────────────

def _load_sessions() -> None:
    """Load persisted sessions from disk, pruning any that have expired."""
    global _sessions
    try:
        with open(SESSION_FILE, "r") as f:
            data = json.load(f)
        now = time.time()
        _sessions = {k: v for k, v in data.items() if v.get("expires_at", 0) > now}
    except (FileNotFoundError, json.JSONDecodeError):
        _sessions = {}


def _persist_sessions() -> None:
    """Write current sessions to disk."""
    try:
        with open(SESSION_FILE, "w") as f:
            json.dump(_sessions, f)
    except OSError:
        pass


# Load on module import (i.e. on every server start)
_load_sessions()

_raw_api_id = os.environ.get("TELEGRAM_API_ID", "0")
API_ID = int(_raw_api_id) if _raw_api_id.isdigit() else 0
API_HASH = os.environ.get("TELEGRAM_API_HASH", "")


def _make_client(session_string: str = "") -> TelegramClient:
    return TelegramClient(StringSession(session_string), API_ID, API_HASH)


async def send_code(phone: str) -> str:
    """Send OTP to the phone number. Returns phone_code_hash."""
    client = _make_client()
    await client.connect()
    result = await client.send_code_request(phone)
    session_string = client.session.save()
    _pending[phone] = {
        "client": client,
        "session": session_string,
        "phone_code_hash": result.phone_code_hash,
    }
    return result.phone_code_hash


async def verify_code(phone: str, code: str) -> dict:
    """Verify OTP. Returns {"status": "authenticated"} or {"status": "2fa_required"}."""
    entry = _pending.get(phone)
    if not entry:
        raise ValueError("No pending login for this phone number. Request a new code.")

    client: TelegramClient = entry["client"]
    if not client.is_connected():
        await client.connect()

    try:
        await client.sign_in(phone, code, phone_code_hash=entry["phone_code_hash"])
    except SessionPasswordNeededError:
        # Keep client alive in _pending so verify_2fa can reuse it
        entry["session"] = client.session.save()
        return {"status": "2fa_required"}

    session_string = client.session.save()
    save_session(phone, session_string)
    await client.disconnect()
    del _pending[phone]
    return {"status": "authenticated"}


async def verify_2fa(phone: str, password: str) -> None:
    """Complete sign-in with the user's 2FA cloud password."""
    entry = _pending.get(phone)
    if not entry:
        raise ValueError("No pending login for this phone number. Request a new code.")

    client: TelegramClient = entry["client"]
    if not client.is_connected():
        await client.connect()

    await client.sign_in(password=password)
    session_string = client.session.save()
    save_session(phone, session_string)
    await client.disconnect()
    del _pending[phone]


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
        messages.reverse()  # oldest first
        return messages
    finally:
        await client.disconnect()


def get_session(phone: str) -> Optional[str]:
    entry = _sessions.get(phone)
    if not entry:
        return None
    if time.time() > entry["expires_at"]:
        del _sessions[phone]
        _persist_sessions()
        return None
    return entry["session"]


def save_session(phone: str, session_string: str) -> None:
    _sessions[phone] = {
        "session": session_string,
        "expires_at": time.time() + SESSION_TTL,
    }
    _persist_sessions()


def session_status(phone: str) -> dict:
    entry = _sessions.get(phone)
    if not entry:
        return {"authenticated": False}
    remaining = entry["expires_at"] - time.time()
    if remaining <= 0:
        del _sessions[phone]
        _persist_sessions()
        return {"authenticated": False}
    return {"authenticated": True, "expires_in": int(remaining)}
