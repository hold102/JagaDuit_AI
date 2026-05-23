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

  const inputStyle = {
    all: "unset", boxSizing: "border-box", width: "100%",
    background: "#fff", border: "1px solid var(--ink-200)",
    borderRadius: "var(--r-md)", padding: "11px 13px",
    fontFamily: "var(--ff-sans)", fontSize: 14, color: "var(--ink-900)"
  }

  return (
    <div className="scr">
      <div className="scr-header scr-header-dark">
        <button className="back-btn back-btn-dark" onClick={() => navigate(-1)}>‹</button>
        <div style={{ flex: 1 }}>
          <div className="hdr-title hdr-title-white" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 18 }}>📧</span> Gmail Scanner
          </div>
          <div className="hdr-sub hdr-sub-white">Scan suspicious emails with AI</div>
        </div>
      </div>

      <div className="scr-body" style={{ padding: "0 18px" }}>
        {error && (
          <div style={{ marginTop: 14, padding: "10px 13px", background: "var(--risk-high-bg)", border: "1px solid rgba(196,28,51,.2)", borderRadius: "var(--r-md)", fontSize: 13, color: "var(--risk-high)" }}>
            {error}
          </div>
        )}

        {step === STEP.IDLE && (
          <div style={{ paddingTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--navy-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>📧</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink-900)", letterSpacing: "-.01em" }}>Received a suspicious email?</div>
              <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6, lineHeight: 1.5 }}>
                Connect your Gmail account and select any suspicious email. AI analyses the full content — no copy-paste needed.
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-400)", padding: "10px 16px", background: "var(--ink-50)", borderRadius: "var(--r-md)", lineHeight: 1.5, width: "100%", textAlign: "left" }}>
              🔒 Read-only access. JagaDuit AI cannot send emails or modify your inbox.
            </div>
            <button className="btn btn-pri" onClick={handleConnect} disabled={busy} style={{ width: "100%" }}>
              {busy ? "Connecting…" : "Connect Gmail Account"}
            </button>
          </div>
        )}

        {step === STEP.EMAILS && (
          <div style={{ paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-500)", marginBottom: 8 }}>
              Recent Inbox — select email to scan
            </div>
            <div style={{ background: "var(--ink-100)", borderRadius: "var(--r-md)", overflow: "hidden", display: "flex", flexDirection: "column", gap: 1 }}>
              {emails.map(email => (
                <button key={email.id} onClick={() => handleSelectEmail(email)}
                  style={{ all: "unset", background: "#fff", display: "flex", flexDirection: "column", padding: "12px 14px", cursor: "pointer", boxSizing: "border-box", gap: 3 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {email.subject || "(No subject)"}
                    </div>
                    <span style={{ color: "var(--ink-400)", fontSize: 14, flexShrink: 0 }}>›</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.sender}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.snippet}</div>
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
