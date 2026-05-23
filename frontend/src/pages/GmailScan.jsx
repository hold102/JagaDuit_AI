import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { gmailAuthUrl, gmailEmails, gmailAnalyze } from "../utils/api"

const STEP = { IDLE: "idle", EMAILS: "emails", LOADING: "loading" }

export default function GmailScan() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { setTransferData } = useTransfer()

  const [step, setStep]         = useState(STEP.IDLE)
  const [sessionToken, setToken]= useState(params.get("session") || "")
  const [emails, setEmails]     = useState([])
  const [error, setError]       = useState("")
  const [busy, setBusy]         = useState(false)

  // Auto-load emails if returning from OAuth
  useEffect(() => {
    const status = params.get("status")
    const session = params.get("session")
    if (status === "ok" && session) {
      setToken(session)
      loadEmails(session)
    } else if (status === "error") {
      setError("Google authentication failed. Please try again.")
    }
  }, [])

  async function handleConnect() {
    setBusy(true); setError("")
    try {
      const { auth_url } = await gmailAuthUrl()
      window.location.href = auth_url
    } catch {
      setError("Failed to get Google auth URL. Check backend connection.")
      setBusy(false)
    }
  }

  async function loadEmails(token) {
    setBusy(true); setError("")
    try {
      const { emails: list } = await gmailEmails(token)
      setEmails(list)
      setStep(STEP.EMAILS)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load emails.")
    } finally { setBusy(false) }
  }

  async function handleSelectEmail(email) {
    setTransferData(prev => ({ ...prev, recipient: email.sender }))
    navigate("/analyzing", {
      state: {
        gmail: {
          session_token: sessionToken,
          email_id: email.id,
          sender: email.sender,
          subject: email.subject,
        }
      }
    })
  }

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 18 }}>📧</span> Gmail Scanner
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Scan suspicious emails with AI</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 40px" }}>
        {/* Error */}
        {error && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 14, fontSize: 13, color: "#fca5a5" }}>
            {error}
          </div>
        )}

        {/* Idle / connect step */}
        {step === STEP.IDLE && (
          <div style={{ paddingTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>📧</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>Received a suspicious email?</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 8, lineHeight: 1.55, maxWidth: 280 }}>
                Connect your Gmail account and select any suspicious email. AI analyses the full content — no copy-paste needed.
              </div>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "12px 16px", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 14, lineHeight: 1.55, width: "100%", textAlign: "left", boxSizing: "border-box" }}>
              🔒 Read-only access. JagaDuit AI cannot send emails or modify your inbox.
            </div>
            <button
              onClick={handleConnect}
              disabled={busy}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: busy ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #a78bfa, #ec4899)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Connecting…" : "Connect Gmail Account"}
            </button>
          </div>
        )}

        {/* Email list */}
        {step === STEP.EMAILS && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "rgba(255,255,255,0.45)", marginBottom: 12 }}>
              Recent Inbox — select email to scan
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", gap: 1 }}>
              {emails.map(email => (
                <button
                  key={email.id}
                  onClick={() => handleSelectEmail(email)}
                  style={{ all: "unset", background: "rgba(255,255,255,0.03)", display: "flex", flexDirection: "column", padding: "13px 14px", cursor: "pointer", boxSizing: "border-box", gap: 3, borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {email.subject || "(No subject)"}
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, flexShrink: 0 }}>›</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.sender}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.snippet}</div>
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
