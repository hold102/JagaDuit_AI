# JagaDuit AI

JagaDuit AI is a scam-risk analysis app with a FastAPI backend and a Vite/React frontend. It supports manual evidence analysis, Telegram direct scan, and voice call monitoring.

## Project Structure

- `backend/main.py` - FastAPI app setup, CORS, and route mounting.
- `backend/routes/analyze.py` - message, chat, and call analysis endpoints.
- `backend/routes/telegram.py` - Telegram authentication, chat listing, and direct scan endpoints.
- `backend/routes/voice.py` - live voice-monitoring WebSocket endpoint.
- `backend/services/telegram_service.py` - Telethon integration, Telegram sessions, chat retrieval, and message fetching.
- `backend/services/risk_engine.py` - local deterministic scam-risk checks.
- `backend/services/ai_analyzer.py` - DeepSeek analysis client and response normalization.
- `frontend/src/utils/api.js` - frontend API client and endpoint wrappers.
- `frontend/src/pages/TelegramScan.jsx` - Telegram login and chat selection UI.
- `frontend/src/pages/VoiceScan.jsx` - live call monitoring and voice summary UI.
- `frontend/src/pages/Analyzing.jsx` - analysis dispatch page, including Telegram scan flow.
- `frontend/src/pages/TelegramResult.jsx` - Telegram scan result UI.

## Backend Setup

Install Python dependencies from the backend folder:

```powershell
cd backend
pip install -r requirements.txt
```

Create `backend/.env` using `backend/.env.example` as the template.

Required for Telegram Direct Scan:

```env
TELEGRAM_API_ID=your_telegram_api_id
TELEGRAM_API_HASH=your_telegram_api_hash
```

Required for AI analysis:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat
```

If `DEEPSEEK_API_KEY` is missing or invalid, normal REST analysis falls back to the local rule engine. Live voice monitoring also falls back to local scoring instead of breaking the WebSocket stream.

After changing `backend/.env`, restart the backend server. The backend loads environment variables on startup and the DeepSeek client can stay cached in the running process.

Run the backend:

```powershell
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```powershell
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## Frontend Setup

Install frontend dependencies and run Vite:

```powershell
cd frontend
npm install
npm run dev
```

The frontend API base URL defaults to:

```text
http://127.0.0.1:8000
```

Override it with:

```env
VITE_API_URL=http://127.0.0.1:8000
```

## Voice Call Monitoring

Voice call monitoring has two modes in `frontend/src/pages/VoiceScan.jsx`:

- `Live transcript` - listens through the browser microphone, displays live transcript text, and sends accumulated transcript text to the backend WebSocket for real-time scoring.
- `Voice summary` - lets the user type or dictate a call summary, then sends it through the normal `POST /api/analyze-call` flow.

Important: the app does not use a separate speech-to-text API key. Live transcript uses the browser Web Speech API:

```js
window.SpeechRecognition || window.webkitSpeechRecognition
```

This means live transcript requires:

- Chrome or Edge.
- Microphone permission allowed by the browser.
- A secure browser context or localhost during development.
- The user to speak clearly enough for the browser speech engine to produce transcript text.

If the browser does not support Web Speech API, the UI shows:

```text
Speech-to-text not supported. Use Chrome or Edge.
```

### Voice WebSocket Endpoint

The live monitoring WebSocket is mounted at:

```text
ws://127.0.0.1:8000/api/voice/scan
```

The frontend builds this URL from `VITE_API_URL`:

```js
const WS_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")
  .replace(/^http/, "ws") + "/api/voice/scan"
```

Request message:

```json
{
  "accumulated": "Caller transcript text..."
}
```

If the transcript is too short, the backend returns:

```json
{
  "status": "listening"
}
```

The backend waits for roughly 30+ characters before scoring because very short transcript snippets do not provide enough context.

Successful analysis response:

```json
{
  "status": "analyzed",
  "risk_score": 85,
  "risk_level": "high",
  "risk_status": "UNSAFE",
  "scam_type": "authority_impersonation",
  "red_flags": ["Caller asked for OTP"],
  "app_download_detected": false,
  "otp_solicitation_detected": true,
  "deepseek_success": true,
  "fallback_used": false
}
```

If DeepSeek fails but local scoring works, the response can still be `analyzed`:

```json
{
  "status": "analyzed",
  "deepseek_success": false,
  "fallback_used": true,
  "deepseek_error": {
    "status_code": 401,
    "error_type": "AuthenticationError",
    "message": "..."
  }
}
```

### Voice Summary Endpoint

Voice summary mode uses:

```http
POST /api/analyze-call
```

Request:

```json
{
  "evidenceSource": "phone_call",
  "inputMode": "voice_summary",
  "transcript": "Caller asked me to share OTP and move money to a safe account.",
  "amount": "",
  "recipientName": "",
  "recipientAccount": "",
  "paymentContext": "transfer_before_payment"
}
```

The frontend sends this through the `/analyzing` page.

## DeepSeek API Key Check

To verify whether the current DeepSeek key is loaded without exposing it:

```powershell
cd backend
python -c "from dotenv import load_dotenv; import os; load_dotenv('.env', override=True); k=os.getenv('DEEPSEEK_API_KEY',''); print(bool(k), (k[:6]+'...'+k[-4:]) if len(k)>12 else '')"
```

To verify whether the key is valid, run a small DeepSeek request:

```powershell
cd backend
python -c "from dotenv import load_dotenv; from openai import OpenAI; import os; load_dotenv('.env', override=True); c=OpenAI(api_key=os.environ['DEEPSEEK_API_KEY'], base_url='https://api.deepseek.com'); r=c.chat.completions.create(model=os.getenv('DEEPSEEK_MODEL','deepseek-chat'), max_tokens=8, messages=[{'role':'user','content':'Reply OK'}]); print(r.choices[0].message.content)"
```

If the key is invalid, DeepSeek returns a `401 AuthenticationError`. Replace `DEEPSEEK_API_KEY` in `backend/.env`, then restart the backend.

## Telegram Direct Scan Flow

Telegram Direct Scan lets a user connect Telegram, select a recent chat, fetch recent text messages, and run scam-risk analysis on the combined conversation.

The main frontend flow is:

1. User opens Telegram Scan.
2. Frontend checks session status with `GET /api/telegram/session-status`.
3. If unauthenticated, user enters phone number.
4. Backend sends Telegram OTP through `POST /api/telegram/send-code`.
5. User enters OTP through `POST /api/telegram/verify-code`.
6. If Telegram two-step verification is enabled, user completes `POST /api/telegram/verify-2fa`.
7. Frontend loads chats through `GET /api/telegram/chats`.
8. User selects a chat.
9. Frontend calls `POST /api/telegram/scan-chat`.
10. Backend fetches messages from Telegram and passes the combined chat text into the analysis engine.

## Telegram API Endpoints

All Telegram routes are mounted under:

```text
/api/telegram
```

### Send Login Code

```http
POST /api/telegram/send-code
```

Request:

```json
{
  "phone": "+601XXXXXXXX"
}
```

Success:

```json
{
  "success": true,
  "message": "Verification code sent."
}
```

Common errors:

- `missing_credentials` - `TELEGRAM_API_ID` or `TELEGRAM_API_HASH` is missing.
- `invalid_phone` - phone number format is invalid.
- `flood_wait` - Telegram rate limit.

### Verify Login Code

```http
POST /api/telegram/verify-code
```

Request:

```json
{
  "phone": "+601XXXXXXXX",
  "code": "12345"
}
```

Success:

```json
{
  "success": true,
  "message": "Telegram login verified."
}
```

Two-factor required:

```json
{
  "success": false,
  "twoFactorRequired": true,
  "message": "Telegram two-step verification password is required.",
  "code": "two_factor_required"
}
```

### Verify Two-Factor Password

```http
POST /api/telegram/verify-2fa
```

Request:

```json
{
  "phone": "+601XXXXXXXX",
  "password": "telegram_cloud_password"
}
```

Success:

```json
{
  "success": true,
  "message": "Telegram login verified."
}
```

### Check Session Status

```http
GET /api/telegram/session-status?phone=+601XXXXXXXX
```

Authenticated:

```json
{
  "authenticated": true,
  "expires_in": 86399
}
```

Unauthenticated:

```json
{
  "authenticated": false
}
```

### List Recent Chats

```http
GET /api/telegram/chats
```

Optional query:

```text
?phone=+601XXXXXXXX
```

Success:

```json
{
  "success": true,
  "chats": [
    {
      "id": "123456789",
      "title": "Chat Name",
      "name": "Chat Name",
      "type": "user",
      "kind": "user",
      "unread": 0
    }
  ]
}
```

If no active session exists:

```json
{
  "success": false,
  "error": "Not authenticated. Please connect Telegram first.",
  "code": "not_authenticated"
}
```

### Scan Chat

```http
POST /api/telegram/scan-chat
```

Request:

```json
{
  "chatId": "123456789",
  "limit": 30
}
```

`limit` must be between `1` and `100`.

Success:

```json
{
  "success": true,
  "messages": [
    {
      "sender": "them",
      "text": "Example message"
    }
  ],
  "combinedText": "[Telegram chat]: Example message",
  "analysis": {
    "risk_level": "HIGH",
    "risk_score": 80,
    "evidenceSource": "telegram",
    "message_count": 1,
    "chat_name": "Telegram chat"
  }
}
```

Common errors:

- `not_authenticated` - no active Telegram session exists.
- `no_messages` - no text messages were found in the selected chat.
- `scan_failed` - Telegram fetch or analysis failed unexpectedly.
- `missing_credentials` - Telegram API credentials are missing.

## Session Behavior

Telegram sessions are stored in:

```text
backend/data/telegram_sessions/sessions.json
```

The session TTL defaults to 24 hours:

```env
TELEGRAM_SESSION_TTL=86400
```

`telegram_service.py` stores sessions by normalized phone number and tracks one active phone. If exactly one valid session exists, the backend can use it as the active session for direct scan.

## Local Verification Results

The Telegram Direct Scan API was smoke-tested locally.

Backend health check:

```text
GET /health -> 200 {"status":"ok"}
```

Direct scan without login:

```text
POST /api/telegram/scan-chat -> 401
```

Response:

```json
{
  "success": false,
  "error": "Not authenticated. Please connect Telegram first.",
  "code": "not_authenticated"
}
```

This confirms the route is mounted and returning the expected unauthenticated response.

Environment/session check:

```text
TELEGRAM_API_ID=True
TELEGRAM_API_HASH=True
sessions_file=False
```

This means Telegram credentials are configured, but no saved Telegram login session exists yet.

A mocked authenticated scan was also tested. It returned:

```text
POST /api/telegram/scan-chat -> 200
```

Response shape included:

- `success: true`
- fetched `messages`
- `combinedText`
- `analysis.evidenceSource: "telegram"`
- `analysis.message_count`
- `analysis.chat_name`

This confirms the authenticated direct-scan code path is wired correctly.

The live voice monitoring backend was also checked.

Backend health check:

```text
GET /health -> 200 {"status":"ok"}
```

DeepSeek status check:

```text
deepseek_key_loaded=True
deepseek_model=deepseek-chat
```

Current DeepSeek validation result at the time of this check:

```text
deepseek_valid=False
error_type=AuthenticationError
401 Authentication Fails
```

This means a key is present in `backend/.env`, but the key currently loaded there was rejected by DeepSeek. Live transcript can still work at the browser transcription layer, but AI-backed DeepSeek scoring requires replacing the key and restarting the backend.

The voice WebSocket route is mounted at:

```text
/api/voice/scan
```

The route accepts transcript text over WebSocket. It does not perform microphone recording or speech-to-text on the backend.

## How To Test Live Call Monitoring

1. Start the backend.
2. Start the frontend.
3. Use Chrome or Edge.
4. Open the Voice Scanner page.
5. Choose `Live transcript`.
6. Click `Start`.
7. Allow microphone permission.
8. Speak a test phrase such as:

```text
This is your bank. Do not tell anyone. Share your OTP now or your account will be blocked.
```

Expected UI behavior:

- The live transcript box should show detected words.
- The header should show `LIVE` once the WebSocket connects.
- After enough transcript text is collected and the caller pauses, the backend should return risk scoring.

If the transcript does not appear:

- Use Chrome or Edge.
- Check browser microphone permission.
- Make sure another app is not blocking the microphone.
- Try the `Voice summary` mode as a fallback.

If transcript appears but risk scoring fails:

- Check whether the backend is running on `127.0.0.1:8000`.
- Check `VITE_API_URL`.
- Check the browser console for WebSocket connection errors.
- Validate `DEEPSEEK_API_KEY`.
- Restart the backend after changing `.env`.

## How To Test A Real Telegram Scan

1. Start the backend.
2. Start the frontend.
3. Open the Telegram Scan page.
4. Enter a real Telegram phone number with country code.
5. Complete OTP verification.
6. Complete two-step verification if Telegram asks for it.
7. Select a chat.
8. Confirm the app reaches the Telegram result screen.

If the scan returns `not_authenticated`, log in again because there is no active session or the session expired.

If the scan returns `no_messages`, select a chat with recent text messages. Media-only messages are skipped.

If the scan returns `scan_failed`, check the backend terminal logs for the underlying Telegram or analysis error.

## Security Notes

- Telegram API credentials should stay in `backend/.env`.
- Do not commit real `.env` files or Telegram session files.
- Session strings are sensitive because they grant access to the Telegram account while valid.
- The demo session storage is file-based and intended for local/development use.
