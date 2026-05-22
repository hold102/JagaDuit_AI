import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { telegramSessionStatus, telegramConnect, telegramVerify, telegramVerify2FA, telegramChats, telegramAnalyze } from "../utils/api"

const STEP = { CHECKING: "checking", PHONE: "phone", CODE: "code", TWO_FA: "2fa", CHATS: "chats", LOADING: "loading" }
const STORAGE_KEY = "tg_phone"

export default function TelegramScan() {
  const navigate = useNavigate()
  const { setTransferData } = useTransfer()

  const [step, setStep]       = useState(STEP.CHECKING)
  const [phone, setPhone]     = useState(localStorage.getItem(STORAGE_KEY) || "")
  const [code, setCode]       = useState("")
  const [password, setPassword] = useState("")
  const [chats, setChats]     = useState([])
  const [error, setError]     = useState("")
  const [busy, setBusy]       = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) { setStep(STEP.PHONE); return }
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

  const inputStyle = { all: "unset", boxSizing: "border-box", width: "100%", background: "#fff", border: "1px solid var(--ink-200)", borderRadius: "var(--r-md)", padding: "11px 13px", fontFamily: "var(--ff-sans)", fontSize: 14, color: "var(--ink-900)" }

  return (
    <div className="scr">
      <div className="scr-header scr-header-dark">
        <button className="back-btn back-btn-dark" onClick={() => navigate(-1)}>‹</button>
        <div style={{ flex: 1 }}>
          <div className="hdr-title hdr-title-white">✈️ Telegram Scan</div>
          <div className="hdr-sub hdr-sub-white">AI reads your chat automatically</div>
        </div>
      </div>

      <div className="scr-body" style={{ padding: "0 18px" }}>
        {/* Step indicator */}
        {step !== STEP.CHECKING && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "14px 0 0" }}>
            {stepLabels.map((label, i) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: stepActive === i ? 16 : 6, height: 6, borderRadius: 100, background: stepDone(i) ? "var(--navy-600)" : stepActive === i ? "var(--navy-700)" : "var(--ink-200)", transition: "all .2s" }} />
                <span style={{ fontSize: 11, color: stepActive === i || stepDone(i) ? "var(--ink-700)" : "var(--ink-400)", fontWeight: stepActive === i ? 600 : 400 }}>{label}</span>
                {i < 2 && <span style={{ color: "var(--ink-300)", fontSize: 12 }}>›</span>}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: "10px 13px", background: "var(--risk-high-bg)", border: "1px solid rgba(196,28,51,.2)", borderRadius: "var(--r-md)", fontSize: 13, color: "var(--risk-high)" }}>
            {error}
          </div>
        )}

        {/* Checking */}
        {step === STEP.CHECKING && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", flexDirection: "column", gap: 12, textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "3px solid var(--ink-200)", borderTopColor: "var(--navy-800)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13, color: "var(--ink-500)", margin: 0 }}>Checking session…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Phone */}
        {step === STEP.PHONE && (
          <form onSubmit={handleSendCode} style={{ paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field-lbl">Your Telegram phone number</div>
            <input style={inputStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+601XXXXXXXX" required />
            <p style={{ fontSize: 11, color: "var(--ink-400)", margin: 0, lineHeight: 1.5 }}>
              We connect directly to Telegram on your behalf. Your session is only stored in memory.
            </p>
            <button type="submit" disabled={busy || !phone} className="btn btn-pri">
              {busy ? "Sending code…" : "Send Verification Code"}
            </button>
          </form>
        )}

        {/* OTP */}
        {step === STEP.CODE && (
          <form onSubmit={handleVerify} style={{ paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field-lbl">Verification code from Telegram</div>
            <input style={{ ...inputStyle, textAlign: "center", fontFamily: "var(--ff-mono)", fontSize: 22, letterSpacing: 8 }} type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="·····" maxLength={10} required autoFocus />
            <button type="submit" disabled={busy || !code} className="btn btn-pri">
              {busy ? "Verifying…" : "Verify & Load Chats"}
            </button>
            <button type="button" onClick={() => setStep(STEP.PHONE)} className="btn btn-ghost" style={{ fontSize: 12, color: "var(--ink-400)" }}>
              Use a different number
            </button>
          </form>
        )}

        {/* 2FA */}
        {step === STEP.TWO_FA && (
          <form onSubmit={handle2FA} style={{ paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "10px 13px", background: "var(--gold-50)", border: "1px solid rgba(245,197,24,.3)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", gap: 9 }}>
              <span>🔒</span>
              <p style={{ fontSize: 12, color: "var(--navy-800)", margin: 0, fontWeight: 500 }}>Two-step verification is enabled on your account.</p>
            </div>
            <div className="field-lbl">Telegram 2FA password</div>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your cloud password" required autoFocus />
            <p style={{ fontSize: 11, color: "var(--ink-400)", margin: 0, lineHeight: 1.5 }}>
              This is the password from Telegram → Settings → Privacy → Two-Step Verification.
            </p>
            <button type="submit" disabled={busy || !password} className="btn btn-pri">
              {busy ? "Verifying…" : "Confirm Password"}
            </button>
          </form>
        )}

        {/* Chat list */}
        {step === STEP.CHATS && (
          <div style={{ paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: "var(--ink-500)", marginBottom: 8 }}>
              Logged in as <span style={{ fontWeight: 600, color: "var(--ink-700)", fontFamily: "var(--ff-mono)" }}>{phone}</span> ·{" "}
              <button style={{ all: "unset", color: "var(--navy-700)", fontWeight: 500, cursor: "pointer", textDecoration: "underline" }}
                onClick={() => { localStorage.removeItem(STORAGE_KEY); setChats([]); setStep(STEP.PHONE) }}>
                Not you?
              </button>
            </div>
            <div className="field-lbl" style={{ marginBottom: 8 }}>Select a chat to scan</div>
            <div style={{ background: "var(--ink-100)", borderRadius: "var(--r-md)", overflow: "hidden", display: "flex", flexDirection: "column", gap: 1 }}>
              {chats.map(chat => (
                <button key={chat.id} onClick={() => handleSelectChat(chat)}
                  style={{ all: "unset", background: "#fff", display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", cursor: "pointer", boxSizing: "border-box" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--navy-50)", color: "var(--navy-800)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                    {chat.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chat.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 1, textTransform: "capitalize" }}>{chat.kind}</div>
                  </div>
                  {chat.unread > 0 && <span style={{ background: "var(--navy-800)", color: "#fff", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 100 }}>{chat.unread}</span>}
                  <span style={{ color: "var(--ink-400)" }}>›</span>
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
