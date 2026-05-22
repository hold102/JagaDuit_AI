from __future__ import annotations

import base64
import os
import re
from typing import Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

CLIENT_CONFIG = {
    "web": {
        "client_id":     os.environ.get("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
        "auth_uri":      "https://accounts.google.com/o/oauth2/auth",
        "token_uri":     "https://oauth2.googleapis.com/token",
        "redirect_uris": [os.environ.get("GOOGLE_REDIRECT_URI",
                          "http://localhost:8000/api/gmail/callback")],
    }
}

# In-memory session store: state_token → credentials dict
_sessions: dict[str, dict] = {}


def get_auth_url() -> tuple[str, str]:
    """Returns (auth_url, state) to redirect the user to Google OAuth."""
    flow = Flow.from_client_config(CLIENT_CONFIG, scopes=SCOPES)
    flow.redirect_uri = CLIENT_CONFIG["web"]["redirect_uris"][0]
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return auth_url, state


def exchange_code(code: str, state: str) -> dict:
    """Exchange OAuth code for credentials and store session."""
    flow = Flow.from_client_config(CLIENT_CONFIG, scopes=SCOPES, state=state)
    flow.redirect_uri = CLIENT_CONFIG["web"]["redirect_uris"][0]
    flow.fetch_token(code=code)
    creds = flow.credentials
    cred_dict = {
        "token":         creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri":     creds.token_uri,
        "client_id":     creds.client_id,
        "client_secret": creds.client_secret,
        "scopes":        list(creds.scopes or []),
    }
    _sessions[state] = cred_dict
    return cred_dict


def get_credentials(session_token: str) -> Optional[Credentials]:
    d = _sessions.get(session_token)
    if not d:
        return None
    return Credentials(
        token         = d["token"],
        refresh_token = d.get("refresh_token"),
        token_uri     = d["token_uri"],
        client_id     = d["client_id"],
        client_secret = d["client_secret"],
        scopes        = d["scopes"],
    )


def save_session(token: str, cred_dict: dict) -> None:
    _sessions[token] = cred_dict


def list_emails(session_token: str, max_results: int = 20) -> list[dict]:
    """Return recent emails from inbox."""
    creds = get_credentials(session_token)
    if not creds:
        raise ValueError("Not authenticated.")
    service = build("gmail", "v1", credentials=creds)
    result  = service.users().messages().list(
        userId="me", labelIds=["INBOX"], maxResults=max_results
    ).execute()
    messages = result.get("messages", [])
    emails = []
    for msg in messages:
        detail = service.users().messages().get(
            userId="me", id=msg["id"], format="metadata",
            metadataHeaders=["Subject", "From", "Date"]
        ).execute()
        headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}
        emails.append({
            "id":      msg["id"],
            "subject": headers.get("Subject", "(No subject)"),
            "sender":  headers.get("From", "Unknown"),
            "date":    headers.get("Date", ""),
            "snippet": detail.get("snippet", ""),
        })
    return emails


def fetch_email_body(session_token: str, email_id: str) -> str:
    """Fetch full plain-text body of a single email."""
    creds = get_credentials(session_token)
    if not creds:
        raise ValueError("Not authenticated.")
    service = build("gmail", "v1", credentials=creds)
    msg = service.users().messages().get(
        userId="me", id=email_id, format="full"
    ).execute()
    return _extract_body(msg.get("payload", {}))


def _extract_body(payload: dict) -> str:
    parts = payload.get("parts", [])
    if parts:
        for part in parts:
            if part.get("mimeType") == "text/plain":
                data = part.get("body", {}).get("data", "")
                if data:
                    return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
        # Recurse into nested parts
        for part in parts:
            result = _extract_body(part)
            if result:
                return result
    # No parts — body is directly in payload
    data = payload.get("body", {}).get("data", "")
    if data:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    return ""
