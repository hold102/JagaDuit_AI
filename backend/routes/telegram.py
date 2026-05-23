from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from routes.analyze import analyze_evidence
from services.telegram_service import (
    TelegramAuthError,
    TelegramConfigError,
    fetch_messages,
    get_active_session,
    get_session,
    list_recent_chats,
    send_code,
    session_status,
    validate_credentials,
    verify_2fa,
    verify_code,
)

router = APIRouter(prefix="/telegram")


class SendCodeRequest(BaseModel):
    phone: str


class VerifyCodeRequest(BaseModel):
    phone: str
    code: str


class Verify2FARequest(BaseModel):
    phone: str
    password: str


class ChatsRequest(BaseModel):
    phone: str = ""


class ScanChatRequest(BaseModel):
    chatId: str
    limit: int = Field(default=30, ge=1, le=100)


class LegacyAnalyzeRequest(BaseModel):
    phone: str
    chat_id: str
    chat_name: str = "Telegram chat"
    message_limit: int = Field(default=30, ge=1, le=100)


def _error(message: str, code: str = "telegram_error", status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": message, "code": code},
    )


def _format_chats(chats: list[dict]) -> list[dict]:
    formatted = []
    for chat in chats:
        title = chat.get("title") or chat.get("name") or "Unknown"
        kind = chat.get("type") or chat.get("kind") or "chat"
        formatted.append(
            {
                "id": str(chat.get("id")),
                "title": title,
                "name": title,
                "type": kind,
                "kind": kind,
                "unread": chat.get("unread", 0),
            }
        )
    return formatted


def _session_from_phone(phone: str):
    if phone:
        return get_session(phone)
    return get_active_session()


def _combined_text(messages: list[dict], chat_name: str = "Telegram chat") -> str:
    return "\n".join(
        f"[{'Me' if message.get('sender') == 'me' else chat_name}]: {message.get('text', '')}"
        for message in messages
        if message.get("text")
    )


async def _scan_session_chat(session: str, chat_id: str, limit: int, chat_name: str = "Telegram chat") -> dict:
    messages = await fetch_messages(session, int(chat_id), limit)
    if not messages:
        raise TelegramAuthError("No text messages found in this chat.", "no_messages")

    combined_text = _combined_text(messages, chat_name)
    analysis = await analyze_evidence(
        combined_text,
        {
            "requestSource": "telegram",
            "evidenceSource": "telegram",
            "recipient": chat_name,
            "receiverName": chat_name,
            "recipientType": "unknown",
            "paymentPurpose": "telegram_direct_scan",
            "isNewReceiver": True,
        },
    )
    analysis["evidenceSource"] = "telegram"
    analysis["message_count"] = len(messages)
    analysis["chat_name"] = chat_name

    return {
        "success": True,
        "messages": messages,
        "combinedText": combined_text,
        "analysis": analysis,
    }


@router.post("/send-code")
async def telegram_send_code(req: SendCodeRequest):
    try:
        validate_credentials()
        await send_code(req.phone)
        return {"success": True, "message": "Verification code sent."}
    except TelegramConfigError as exc:
        return _error(str(exc), "missing_credentials", 400)
    except TelegramAuthError as exc:
        return _error(str(exc), exc.code, 400)


@router.post("/verify-code")
async def telegram_verify_code(req: VerifyCodeRequest):
    try:
        result = await verify_code(req.phone, req.code)
        if result.get("two_factor_required"):
            return {
                "success": False,
                "twoFactorRequired": True,
                "message": "Telegram two-step verification password is required.",
                "code": "two_factor_required",
            }
        return {"success": True, "message": "Telegram login verified."}
    except TelegramAuthError as exc:
        return _error(str(exc), exc.code, 401)


@router.post("/verify-2fa")
async def telegram_verify_two_fa(req: Verify2FARequest):
    try:
        await verify_2fa(req.phone, req.password)
        return {"success": True, "message": "Telegram login verified."}
    except TelegramAuthError as exc:
        return _error(str(exc), exc.code, 401)


@router.get("/chats")
async def telegram_chats(phone: str = ""):
    session = _session_from_phone(phone)
    if not session:
        return _error("Not authenticated. Please connect Telegram first.", "not_authenticated", 401)
    try:
        chats = await list_recent_chats(session)
        return {"success": True, "chats": _format_chats(chats)}
    except TelegramConfigError as exc:
        return _error(str(exc), "missing_credentials", 400)
    except TelegramAuthError as exc:
        return _error(str(exc), exc.code, 400)
    except Exception:
        return _error("Failed to load Telegram chats. Please try again.", "chat_load_failed", 502)


@router.post("/scan-chat")
async def telegram_scan_chat(req: ScanChatRequest):
    session = get_active_session()
    if not session:
        return _error("Not authenticated. Please connect Telegram first.", "not_authenticated", 401)
    try:
        return await _scan_session_chat(session, req.chatId, req.limit)
    except TelegramConfigError as exc:
        return _error(str(exc), "missing_credentials", 400)
    except TelegramAuthError as exc:
        return _error(str(exc), exc.code, 400)
    except Exception:
        return _error("Failed to scan this Telegram chat. Please try again.", "scan_failed", 502)


# Legacy endpoint aliases kept so existing UI paths and old demos do not break.
@router.get("/session-status")
def check_session(phone: str):
    try:
        return session_status(phone)
    except TelegramAuthError:
        return {"authenticated": False}


@router.post("/connect")
async def connect(req: SendCodeRequest):
    return await telegram_send_code(req)


@router.post("/verify")
async def verify(req: VerifyCodeRequest):
    result = await telegram_verify_code(req)
    if isinstance(result, JSONResponse):
        return result
    if result.get("success"):
        return {"status": "authenticated", "success": True}
    return result


@router.post("/chats")
async def chats(req: ChatsRequest):
    session = _session_from_phone(req.phone)
    if not session:
        return _error("Not authenticated. Please connect Telegram first.", "not_authenticated", 401)
    try:
        result = await list_recent_chats(session)
        return {"success": True, "chats": _format_chats(result)}
    except TelegramConfigError as exc:
        return _error(str(exc), "missing_credentials", 400)
    except Exception:
        return _error("Failed to load Telegram chats. Please try again.", "chat_load_failed", 502)


@router.post("/analyze")
async def analyze(req: LegacyAnalyzeRequest):
    session = get_session(req.phone)
    if not session:
        return _error("Not authenticated. Please connect Telegram first.", "not_authenticated", 401)
    try:
        result = await _scan_session_chat(session, req.chat_id, req.message_limit, req.chat_name)
        return result["analysis"]
    except TelegramConfigError as exc:
        return _error(str(exc), "missing_credentials", 400)
    except TelegramAuthError as exc:
        return _error(str(exc), exc.code, 400)
    except Exception:
        return _error("Failed to scan this Telegram chat. Please try again.", "scan_failed", 502)
