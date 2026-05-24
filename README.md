# JagaDuit AI

JagaDuit AI is an AI-powered scam prevention layer for Malaysian online banking.
It sits in front of the "Transfer" flow of a mock mobile bank app and runs every
outgoing payment, chat screenshot, voice call summary, Telegram thread and Gmail
message through a multi-signal risk engine before any money leaves the account.

The project was built for a hackathon and demonstrates how rule-based heuristics,
a fine-tuned scam classifier, a remote LLM and behavioral anomaly detection can
be combined into a single SAFE / UNSAFE verdict — with a 30-second cooling-off
period for high-risk transfers that mirrors Bank Negara Malaysia's proposed
mandatory cooling-off requirement.

---

## Introduction

Online scams in Malaysia are increasingly multi-channel: a victim is contacted
on WhatsApp, pressured on a phone call, asked to install an APK, hand over an
OTP and then transfer to a brand-new "mule" account. A single rule cannot catch
all of that, and a bank app's traditional checks (balance, daily limit, PIN)
do not look at *what the user is being told to do*.

JagaDuit AI takes the opposite approach. Before confirming a transfer the user
can paste a chat, upload a screenshot (OCR), summarise a phone call, scan a
Telegram thread or scan recent Gmail. Each evidence source is analysed by five
parallel signals and a single risk score is returned to the UI, which then
decides whether to proceed, soft-warn, or block with a cooling-off timer.

The app ships with a fully-styled "phone frame" UI (430px wide, dark Liquid
Glass theme, shared aurora background) so the demo looks and feels like a real
banking app.

---

## Features

### Multi-signal risk engine
Every analysis request fans out to five signals in parallel:

1. **Rule engine** (`services/risk_engine.py`) — deterministic 0-100 score from
   keywords, urgency patterns, new-receiver heuristics, amount thresholds and
   user-selected red flags from the call screener.
2. **DeepSeek LLM analyzer** (`services/ai_analyzer.py`) — sends the evidence
   to a remote LLM that returns a structured `scam_type` and `red_flags`.
3. **scikit-learn classifier** (`services/scam_classifier.py`) — local model
   shipped as `scam_classifier.pkl` for offline / fast prob-of-scam scoring.
4. **Reputation lookup** (`services/reputation.py`) — checks recipient name,
   account number and phone against a flagged-account list.
5. **Behavioral anomaly engine** (`services/behavior_engine.py`) — compares
   amount and recipient against the demo profile; a brand-new recipient at 10x
   normal amount can escalate the verdict on its own.

A dynamic scorer (`services/dynamic_scoring.py`) merges the five signals into
one final score and decides `SAFE` / `UNSAFE`, `low` / `medium` / `high` level
and the `action` field (`PROCEED_TRANSFER` or `COOLING_OFF_MODE`).

### Cooling-off mode
High-risk transfers trigger a 30-second mandatory cooling-off screen with
trusted-contact messaging, scam-type-specific action guides and the option to
cancel before the timer expires.

### Evidence sources
- **Chat scan** — paste text or upload a screenshot (tesseract.js OCR runs
  client-side).
- **Voice call** — typed summary or pre-call red-flag screener.
- **Telegram scan** — server-side via telethon, summarises recent messages
  from a chat and runs the same risk pipeline.
- **Gmail scan** — server-side via Google API, classifies recent emails.
- **Transfer-time check** — full payment context (recipient, amount, source,
  purpose) is included so the engine can apply contextual rules.

### Specialised guards
- **App download guard** (`services/app_download_guard.py`) — detects requests
  to install a side-loaded APK / remote-access tool.
- **OTP guard** (`services/otp_guard.py`) — detects social-engineering attempts
  to extract a one-time password.

### Frontend
- React 19 + Vite 8, React Router 7.
- Tailwind CSS with a custom Liquid Glass dark theme and shared aurora
  background applied at the `Layout` level.
- 430px phone-frame container so every page renders consistently for the demo.
- 15 pages covering bank home, transfer flow, evidence scan, analysing, safe /
  unsafe verdict, cooling-off timer, action guide, trusted contact and the
  Telegram / Voice / Gmail scan flows.

---

## Tech stack

**Backend** — Python 3.11+, FastAPI, Uvicorn, Pydantic v2, OpenAI SDK
(DeepSeek-compatible), scikit-learn, joblib, telethon, google-api-python-client.

**Frontend** — React 19, Vite 8, React Router 7, Tailwind CSS 3, Axios,
tesseract.js (client-side OCR).

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- A DeepSeek API key (any OpenAI-compatible endpoint also works)
- Optional: Telegram API ID / hash, Gmail OAuth credentials, Discord bot token

### 1. Clone

```bash
git clone https://github.com/hold102/JagaDuit_AI.git
cd JagaDuit_AI
```

### 2. Backend

```bash
cd backend
python -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and fill in the keys you have
uvicorn main:app --reload --port 8001
```

Required environment variables (see `backend/.env.example`):

| Variable | Purpose |
| --- | --- |
| `DEEPSEEK_API_KEY` | API key for the LLM analyzer |
| `DEEPSEEK_MODEL` | Model name, default `deepseek-chat` |
| `FRONTEND_ORIGIN` | CORS allow-list for the Vite dev server |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` | Required only if you use Telegram scan |
| `DISCORD_BOT_TOKEN` / `DISCORD_CLIENT_ID` | Optional Discord integration |

Health check: <http://127.0.0.1:8001/health>.

### 3. Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://127.0.0.1:8001" > .env
npm run dev
```

The app opens at <http://localhost:5173>.

### 4. Demo flow

1. Open the bank home and tap **Transfer**.
2. Fill in a recipient, amount and purpose.
3. On the **Check before pay** screen, scan a chat / call / Telegram / Gmail
   thread, or proceed directly.
4. The **Analysing** screen runs all five signals in parallel and routes you
   to **Safe proceed**, **Cooling off** or the action guide depending on the
   final score.

---

## Project layout

```
backend/
  main.py                 # FastAPI app + CORS
  routes/                 # /analyze, /analyze-chat, /analyze-call,
                          # /telegram, /voice, /gmail
  services/
    ai_analyzer.py        # DeepSeek LLM signal
    risk_engine.py        # Rule-based signal
    scam_classifier.py    # sklearn signal (model: scam_classifier.pkl)
    reputation.py         # Flagged-account lookup
    behavior_engine.py    # Behavioral anomaly signal
    dynamic_scoring.py    # Final merge + verdict
    app_download_guard.py # APK / remote-access detection
    otp_guard.py          # OTP solicitation detection
    telegram_service.py   # telethon wrapper
    gmail_service.py      # Google API wrapper
  requirements.txt
  .env.example

frontend/
  src/
    App.jsx               # Router (15 routes inside Layout)
    components/Layout.jsx # 430px phone frame + aurora background
    pages/                # BankHome, TransferFlow, CheckBeforePay,
                          # ChatScan, Analyzing, SafeProceed, CoolingOff,
                          # ActionGuide, TransferSuccess, TransferCancelled,
                          # TelegramScan, TelegramResult, VoiceScan, GmailScan,
                          # TrustedContact
    context/              # TransferContext — shared transfer state
    hooks/, utils/, assets/
  package.json
  vite.config.js
  tailwind.config.js
```

---

## License

Hackathon prototype — released for educational and demonstration purposes.
