# JagaDuit AI Slide Generation Brief

Use this document as the source prompt/context for an AI slide generator.

## Presentation Goal

Create a clear, professional presentation for **JagaDuit AI**, a Malaysian financial scam-risk detection app. The deck should explain the problem, the solution, the product features, the technical architecture, the safety/privacy approach, and the current development status.

Target audience:

- Startup/product reviewers
- Hackathon judges
- Technical evaluators
- Banking/fintech stakeholders
- Potential users who need a simple explanation of the app

Tone:

- Practical
- Trustworthy
- Modern fintech
- Safety-first
- Not overly technical on every slide

Visual style:

- Dark fintech UI aesthetic
- Purple/pink gradient accents
- Mobile-first product screenshots or mockups
- Clean diagrams
- Minimal text per slide
- Use icons for Telegram, Gmail/email, phone call, shield/security, community reporting, AI/risk scoring

## One-Line Product Summary

**JagaDuit AI helps users detect scam risk before sending money by analyzing messages, calls, Telegram chats, Gmail emails, and community-reported scam patterns.**

## Problem Statement

Financial scams often happen before the money transfer:

- Scammers create urgency and fear.
- Victims are pushed to share OTP/TAC/PIN.
- Scammers impersonate banks, police, government agencies, delivery companies, or family members.
- Victims may be told to install remote-access apps.
- People often do not know whether a message, call, chat, or email is safe before acting.

JagaDuit AI addresses this decision point by checking suspicious evidence before the user proceeds with a transfer.

## Solution Overview

JagaDuit AI provides a pre-transfer safety layer:

- User enters transfer/payment details.
- App asks: **"Scan before sending?"**
- User can scan evidence from multiple sources.
- AI and local rules analyze the evidence.
- App returns a risk score, risk level, red flags, and next-step safety guidance.
- High-risk cases trigger a cooling-off flow and action guide.

## Core Features

### 1. Transfer Safety Prompt

- Transfer page collects recipient, account, bank, amount, and purpose.
- Before sending, a bottom sheet asks **"Scan before sending?"**
- Bottom sheet is phone-sized, centered on desktop, and mobile-friendly.
- User can run safety check or skip.

### 2. Manual Evidence Analysis

- User can manually provide suspicious message or payment context.
- Backend analyzes through `POST /api/analyze`.
- Returns risk level, risk score, detected red flags, recommendation, and action guide.

### 3. Telegram Direct Scan

- User connects Telegram with phone number and OTP.
- Supports Telegram two-step verification.
- App lists recent Telegram chats.
- User selects a chat.
- Backend fetches recent text messages and analyzes the conversation.
- Endpoint: `POST /api/telegram/scan-chat`.

### 4. Live Call Monitoring

- Frontend uses browser Web Speech API.
- No separate speech-to-text API key is needed.
- Works best in Chrome or Edge with microphone permission.
- Live transcript is sent to backend WebSocket.
- Endpoint: `WS /api/voice/scan`.
- Backend scores the transcript in near real time.
- Detects OTP requests, app-install requests, impersonation, urgency, and suspicious links.

### 5. Voice Summary Analysis

- User can type or dictate a summary of a suspicious call.
- Sends transcript through `POST /api/analyze-call`.
- Useful when live transcript is unavailable.

### 6. Gmail Scan

- Gmail OAuth flow lets users connect Gmail.
- User lists recent emails and selects a suspicious email.
- Backend fetches email body and analyzes scam risk.
- Endpoints include `/api/gmail/auth-url`, `/api/gmail/emails`, and `/api/gmail/analyze`.

### 7. Community Scam Reports

- Users can submit scam reports.
- Reports are sanitized before local storage.
- Community intelligence can identify repeated scam patterns.
- Endpoint: `POST /api/scam-reports`.
- Report listing: `GET /api/scam-reports`.

### 8. Risk Result And Cooling-Off

- App normalizes backend result into risk status.
- High-risk result activates cooling-off behavior.
- User gets safety actions and trusted contact message.
- App encourages verifying through official channels.

## Technical Architecture

Frontend:

- Vite
- React
- React Router
- Axios API client
- Mobile-first UI pages

Backend:

- FastAPI
- Pydantic request models
- Telethon for Telegram
- Google OAuth/API client for Gmail
- OpenAI Python SDK configured for DeepSeek
- Local rule engine
- Local community intelligence module
- WebSocket route for live voice monitoring

Data/storage:

- `.env` stores API keys and secrets locally.
- Telegram sessions stored locally in `backend/data/telegram_sessions/`.
- Community report prototype storage in `backend/data/scam_reports.json`.
- Sensitive/local data files are ignored by git.

## Risk Scoring System

JagaDuit AI uses layered scoring:

- DeepSeek semantic analysis when valid API key is configured.
- Local deterministic rules for emergency fallback.
- Community pattern matching.
- Voice-specific dynamic scoring.
- ML classifier and reputation scoring where available.

Important behavior:

- If DeepSeek is missing or invalid, REST analysis falls back to local rules.
- Live call monitoring falls back to local scoring instead of breaking the WebSocket stream.
- This keeps the app usable during API failure or key rotation.

## Key API Routes

Core:

```text
GET  /health
POST /api/analyze
POST /api/analyze-risk
POST /api/analyze-chat
POST /api/analyze-call
GET  /api/debug/deepseek-status
```

Telegram:

```text
POST /api/telegram/send-code
POST /api/telegram/verify-code
POST /api/telegram/verify-2fa
GET  /api/telegram/chats
POST /api/telegram/scan-chat
GET  /api/telegram/session-status
```

Voice:

```text
WS /api/voice/scan
```

Gmail:

```text
GET  /api/gmail/auth-url
GET  /api/gmail/callback
POST /api/gmail/emails
POST /api/gmail/analyze
```

Community:

```text
GET  /api/scam-reports
POST /api/scam-reports
```

## Environment Variables

Core AI:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat
```

Frontend/CORS:

```env
FRONTEND_ORIGIN=http://127.0.0.1:5173
```

Telegram:

```env
TELEGRAM_API_ID=your_telegram_api_id
TELEGRAM_API_HASH=your_telegram_api_hash
TELEGRAM_SESSION_TTL=86400
```

Gmail:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/gmail/callback
```

## Privacy And Security Notes

Do not commit:

- `backend/.env`
- API keys
- Telegram session files
- Gmail session data
- Community report data
- Logs
- Build output
- `node_modules`

Security behavior:

- Telegram session strings are sensitive.
- Community reports are sanitized for OTP/TAC/password/PIN-like patterns.
- Gmail OAuth credentials are kept in memory for the running backend process.
- The project uses `.gitignore` to exclude local secrets and generated data.

## Current Verification Status

Verified locally:

- Frontend production build passes with `npm run build`.
- Python backend files pass syntax check with `py_compile`.
- Telegram scan endpoint is mounted.
- Telegram direct scan returns expected `401 not_authenticated` when no session exists.
- Mocked authenticated Telegram scan returns expected success response.
- Voice WebSocket route is mounted.
- Live transcript uses browser Web Speech API, not a separate transcription API.
- DeepSeek key must be valid for AI-backed scoring; invalid key returns `401 AuthenticationError`.
- Local fallback scoring exists for missing/invalid DeepSeek behavior.

Git status:

- Branch: `feature/community-scam-intelligence`
- Remote: `origin/feature/community-scam-intelligence`
- Latest documentation commit pushed.

## Suggested Slide Outline

### Slide 1: Title

Title:
**JagaDuit AI**

Subtitle:
**AI-powered scam detection before you send money**

Include:

- App logo/name
- Mobile fintech visual
- Safety/shield icon

### Slide 2: The Problem

Key message:
Scams happen before the transfer, when users are pressured to act quickly.

Bullets:

- Fake bank/police/government calls
- OTP/TAC theft
- Telegram/social chat scams
- Suspicious emails
- Remote-access app tricks

### Slide 3: The Solution

Key message:
JagaDuit AI checks suspicious evidence before payment.

Flow:

```text
Transfer details -> Scan before sending -> Evidence analysis -> Risk score -> Safety action
```

### Slide 4: Product Experience

Show:

- Transfer form
- "Scan before sending?" bottom sheet
- Risk result screen

Key point:
Mobile-first safety layer integrated into the transfer journey.

### Slide 5: Multi-Source Evidence Scan

Show feature tiles:

- Manual message
- Telegram direct scan
- Live call monitoring
- Voice summary
- Gmail scan
- Community reports

### Slide 6: Telegram Direct Scan

Key points:

- Telegram OTP login
- Chat listing
- Select chat
- Fetch recent text messages
- Analyze conversation risk

### Slide 7: Live Call Monitoring

Key points:

- Browser speech recognition
- Live transcript
- WebSocket scoring
- Detects OTP, impersonation, app install, urgency
- Local fallback if AI key fails

### Slide 8: Community Intelligence

Key points:

- Users report scam patterns
- Reports are sanitized
- Repeated patterns help future detection
- Community-driven scam awareness

### Slide 9: Technical Architecture

Diagram:

```text
React Frontend
  -> FastAPI Backend
    -> DeepSeek AI
    -> Local Rule Engine
    -> Telegram API
    -> Gmail API
    -> Community Intelligence
```

### Slide 10: Risk Scoring

Explain:

- AI semantic analysis
- Rule-based red flags
- Community pattern matching
- Dynamic scoring for voice
- Fallback if external AI fails

### Slide 11: Privacy And Safety

Key points:

- API keys stay in `.env`
- Sessions and reports are ignored by git
- Telegram sessions expire
- Community reports are sanitized
- Sensitive files are excluded from commits

### Slide 12: Demo Flow

Suggested demo:

1. Fill transfer form.
2. Tap Continue.
3. Show `Scan before sending?`.
4. Run safety check.
5. Show Telegram or live call scan.
6. Show risk score and cooling-off/action guide.

### Slide 13: Current Status

Key points:

- Backend and frontend implemented.
- Telegram scan API verified.
- Voice monitoring route verified.
- Community reporting added.
- Documentation completed.
- Branch pushed to GitHub.

### Slide 14: Next Steps

Potential roadmap:

- Production-grade encrypted session storage
- Better report moderation
- More local language support
- Bank/authority hotline integration
- Real production deployment
- User testing with scam scenarios

## Short AI Slide Prompt

Use this if the slide tool only accepts a short prompt:

```text
Create a professional 14-slide pitch/technical deck for JagaDuit AI, a Malaysian financial scam detection app. It helps users scan suspicious evidence before sending money. Cover: scam problem, pre-transfer safety prompt, manual analysis, Telegram direct scan, live call monitoring using browser speech recognition, Gmail scan, community scam reports, FastAPI/React architecture, DeepSeek AI plus local rule fallback scoring, privacy/security practices, demo flow, current status, and roadmap. Use a dark fintech visual style with purple/pink gradient accents, mobile app mockups, simple architecture diagrams, and concise bullet points.
```

## Detailed AI Slide Prompt

Use this if the slide tool supports long prompts:

```text
Build a clean, modern presentation for "JagaDuit AI". The audience is fintech/startup/hackathon evaluators. The product is a Malaysian financial scam-risk detection app that helps users check suspicious evidence before transferring money. The app has a React/Vite frontend and FastAPI backend.

Main story: scams often happen before payment, when users are pressured by fake bank/police/government callers, Telegram/social messages, suspicious emails, OTP/TAC requests, or remote-access app tricks. JagaDuit AI inserts a safety layer into the transfer journey. Before sending money, the app asks "Scan before sending?" and lets users analyze evidence.

Features to include: transfer safety prompt, manual message analysis, Telegram direct scan with OTP login and chat selection, live call monitoring using browser Web Speech API and a backend WebSocket, voice summary analysis, Gmail OAuth email scan, community scam reports, risk result screen, cooling-off mode, and action guide.

Technical architecture: React frontend, FastAPI backend, DeepSeek semantic analysis, local deterministic rule engine, community intelligence module, Telegram via Telethon, Gmail via Google OAuth/API client, voice WebSocket, dynamic scoring, ML classifier/reputation where available. Explain that if DeepSeek API fails or key is invalid, the app falls back to local scoring so users still get safety guidance.

Privacy/security: API keys stay in backend/.env, local session/report data is ignored by git, Telegram session strings are sensitive and expire, Gmail OAuth data is in memory, community reports are sanitized to redact OTP/TAC/password/PIN-like patterns.

Create about 14 slides: title, problem, solution, product flow, multi-source scanning, Telegram scan, live call monitoring, community intelligence, architecture, risk scoring, privacy/security, demo flow, current status, roadmap. Use dark fintech design with purple/pink gradient accents, mobile phone UI mockups, icons, and simple diagrams. Keep each slide concise.
```

