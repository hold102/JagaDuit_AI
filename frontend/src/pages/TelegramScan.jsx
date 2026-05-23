import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { telegramSessionStatus, telegramConnect, telegramVerify, telegramVerify2FA, telegramChats } from "../utils/api"

const STEP = { CHECKING: "checking", PHONE: "phone", CODE: "code", TWO_FA: "2fa", CHATS: "chats", LOADING: "loading" }
const STORAGE_KEY = "tg_phone"

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  color: "#fff",
  padding: "14px 16px",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  colorScheme: "dark",
  fontFamily: "inherit",
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: "rgba(255,255,255,0.5)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: 8,
  display: "block",
}

export default function TelegramScan() {
  const navigate = useNavigate()
  const { setTransferData } = useTransfer()

  const [step, setStep]       = useState(() => localStorage.getItem(STORAGE_KEY) ? STEP.CHECKING : STEP.PHONE)
  const [phone, setPhone]     = useState(localStorage.getItem(STORAGE_KEY) || "")
  const [code, setCode]       = useState("")
  const [password, setPassword] = useState("")
  const [chats, setChats]     = useState([])
  const [error, setError]     = useState("")
  const [busy, setBusy]       = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    telegramSessionStatus(saved)
      .then(({ authenticated }) => {
        if (authenticated) {
          return telegramChats(saved).then(({ chats: list }) => { setChats(list); setStep(STEP.CHATS) })
        } else {
          localStorage.removeItem(STORAGE_KEY)
          setStep(STEP.PHONE)
        }
      })
      .catch(() => setStep(STEP.PHONE))
  }, [])

  async function handleSendCode(e) {
    e.preventDefault(); setError(""); setBusy(true)
    try { await telegramConnect(phone); setStep(STEP.CODE) }
    catch (err) { setError(err.response?.data?.detail || "Failed to send code.") }
    finally { setBusy(false) }
  }

  async function handleVerify(e) {
    e.preventDefault(); setError(""); setBusy(true)
    try {
      const result = await telegramVerify(phone, code)
      if (result.status === "2fa_required") { setStep(STEP.TWO_FA) }
      else {
        localStorage.setItem(STORAGE_KEY, phone)
        const { chats: list } = await telegramChats(phone)
        setChats(list); setStep(STEP.CHATS)
      }
    } catch (err) { setError(err.response?.data?.detail || "Invalid code.") }
    finally { setBusy(false) }
  }

  async function handle2FA(e) {
    e.preventDefault(); setError(""); setBusy(true)
    try {
      await telegramVerify2FA(phone, password)
      localStorage.setItem(STORAGE_KEY, phone)
      const { chats: list } = await telegramChats(phone)
      setChats(list); setStep(STEP.CHATS)
    } catch (err) { setError(err.response?.data?.detail || "Incorrect password.") }
    finally { setBusy(false) }
  }

  async function handleSelectChat(chat) {
    setTransferData(prev => ({ ...prev, recipient: chat.name }))
    navigate("/analyzing", { state: { telegram: { phone, chatId: chat.id, chatName: chat.name, chatKind: chat.kind } } })
  }

  const stepLabels = ["Connect", "Verify", "Select Chat"]
  const stepActive = step === STEP.PHONE || step === STEP.CODE ? 0 : step === STEP.TWO_FA ? 1 : 2
  const stepDone = (i) => (i === 0 && step !== STEP.PHONE && step !== STEP.CHECKING) || (i === 1 && (step === STEP.CHATS || step === STEP.LOADING))

  return (
    <div style={{ minHeight: "100vh", background: "#05060a", color: "#fff", display: "flex", flexDirection: "column", fontFamily: "-apple-system, system-ui, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>✈️ Telegram Scan</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>AI reads your chat automatically</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 40px" }}>
        {/* Step indicator */}
        {step !== STEP.CHECKING && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 20 }}>
            {stepLabels.map((label, i) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: stepActive === i ? 16 : 6,
                  height: 6,
                  borderRadius: 100,
                  background: stepDone(i) ? "#a78bfa" : stepActive === i ? "#c4b5fd" : "rgba(255,255,255,0.15)",
                  transition: "all .2s",
                }} />
                <span style={{ fontSize: 11, color: stepActive === i || stepDone(i) ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)", fontWeight: stepActive === i ? 600 : 400 }}>{label}</span>
                {i < 2 && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>›</span>}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 14, fontSize: 13, color: "#fca5a5" }}>
            {error}
          </div>
        )}

        {/* Checking */}
        {step === STEP.CHECKING && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", flexDirection: "column", gap: 16, textAlign: "center" }}>
            <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>Checking session…</p>
          </div>
        )}

        {/* Phone */}
        {step === STEP.PHONE && (
          <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={labelStyle}>Your Telegram phone number</label>
            <input style={inputStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+601XXXXXXXX" required />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.55 }}>
              We connect directly to Telegram on your behalf. Your session is only stored in memory.
            </p>
            <button
              type="submit"
              disabled={busy || !phone}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: busy || !phone ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #a78bfa, #ec4899)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: busy || !phone ? "not-allowed" : "pointer", opacity: busy || !phone ? 0.55 : 1 }}
            >
              {busy ? "Sending code…" : "Send Verification Code"}
            </button>
          </form>
        )}

        {/* OTP code */}
        {step === STEP.CODE && (
          <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={labelStyle}>Verification code from Telegram</label>
            <input
              style={{ ...inputStyle, textAlign: "center", fontFamily: "monospace", fontSize: 28, letterSpacing: 12 }}
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="·····"
              maxLength={10}
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={busy || !code}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: busy || !code ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #a78bfa, #ec4899)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: busy || !code ? "not-allowed" : "pointer", opacity: busy || !code ? 0.55 : 1 }}
            >
              {busy ? "Verifying…" : "Verify & Load Chats"}
            </button>
            <button
              type="button"
              onClick={() => setStep(STEP.PHONE)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 16, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.55)", fontSize: 13, cursor: "pointer" }}
            >
              Use a different number
            </button>
          </form>
        )}

        {/* 2FA */}
        {step === STEP.TWO_FA && (
          <form onSubmit={handle2FA} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "12px 14px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span>🔒</span>
              <p style={{ fontSize: 12, color: "#fcd34d", margin: 0, fontWeight: 500 }}>Two-step verification is enabled on your account.</p>
            </div>
            <label style={labelStyle}>Telegram 2FA password</label>
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your cloud password"
              required
              autoFocus
            />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.55 }}>
              This is the password from Telegram → Settings → Privacy → Two-Step Verification.
            </p>
            <button
              type="submit"
              disabled={busy || !password}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: busy || !password ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #a78bfa, #ec4899)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: busy || !password ? "not-allowed" : "pointer", opacity: busy || !password ? 0.55 : 1 }}
            >
              {busy ? "Verifying…" : "Confirm Password"}
            </button>
          </form>
        )}

        {/* Chat list */}
        {step === STEP.CHATS && (
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
              Logged in as <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>{phone}</span> ·{" "}
              <button
                style={{ all: "unset", color: "#a78bfa", fontWeight: 500, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}
                onClick={() => { localStorage.removeItem(STORAGE_KEY); setChats([]); setStep(STEP.PHONE) }}
              >
                Not you?
              </button>
            </div>
            <label style={labelStyle}>Select a chat to scan</label>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", gap: 1 }}>
              {chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  style={{ all: "unset", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", cursor: "pointer", boxSizing: "border-box", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(167,139,250,0.15)", border: "0.5px solid rgba(167,139,250,0.3)", color: "#c4b5fd", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {chat.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chat.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1, textTransform: "capitalize" }}>{chat.kind}</div>
                  </div>
                  {chat.unread > 0 && <span style={{ background: "#a78bfa", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100 }}>{chat.unread}</span>}
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}
