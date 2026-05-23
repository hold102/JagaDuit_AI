import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { submitScamReport } from "../utils/api"

const SOURCES = [
  ["telegram", "Telegram"],
  ["phone_call", "Phone Call"],
  ["whatsapp", "WhatsApp"],
  ["sms", "SMS"],
  ["email", "Email"],
  ["messenger_facebook", "Messenger / Facebook"],
  ["instagram_dm", "Instagram DM"],
  ["ocr", "OCR / Screenshot"],
  ["transfer_check", "Transfer check"],
  ["other", "Other"],
]

const SCAM_TYPES = [
  ["bank_impersonation", "Bank impersonation"],
  ["government_impersonation", "Police / government impersonation"],
  ["fake_investment", "Fake investment"],
  ["fake_delivery", "Fake delivery"],
  ["marketplace_scam", "Marketplace scam"],
  ["romance_scam", "Romance scam"],
  ["phishing", "Phishing"],
  ["otp_password_theft", "OTP / password theft"],
  ["other", "Other"],
]

const sourceValues = new Set(SOURCES.map(([value]) => value))
const scamTypeValues = new Set(SCAM_TYPES.map(([value]) => value))

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  color: "#fff",
  padding: "13px 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  colorScheme: "dark",
}

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.5)",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  marginBottom: 8,
  display: "block",
}

export default function ScamReport() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult || {}

  const autofill = useMemo(() => buildAutofill(transferData, result), [transferData, result])
  const [source, setSource] = useState(autofill.evidenceSource)
  const [scamType, setScamType] = useState(autofill.scamType)
  const [summary, setSummary] = useState(autofill.summary)
  const [indicators] = useState(autofill.indicators)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError("")
    try {
      await submitScamReport({
        evidenceSource: source,
        scamType,
        riskLevel: reportRiskLevel(result),
        riskScore: Number(result.risk_score ?? result.riskScore ?? result.score ?? 0),
        detectedIndicators: indicators,
        anonymizedSummary: sanitizeSummary(summary),
        amountRange: amountRange(transferData.amount),
        paymentContext: transferData.paymentContext?.paymentPurpose || "transfer_before_payment",
        userAction: "cancelled_transfer",
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to submit report. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <PageShell title="Report submitted" onBack={() => navigate("/actions")}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 16, padding: "0 20px 120px" }}>
          <div style={{ fontSize: 44 }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Report submitted</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,0.55)", maxWidth: 310 }}>
            Report saved. Sensitive details were removed before storage.
          </div>
        </div>
        <FixedBar gap={10}>
          <button onClick={() => navigate("/community-intelligence")} style={secondaryButtonStyle}>
            View saved reports
          </button>
          <button onClick={() => navigate("/actions")} style={primaryButtonStyle(false)}>
            Back to safety steps
          </button>
        </FixedBar>
      </PageShell>
    )
  }

  return (
    <PageShell title="Report scam pattern" onBack={() => navigate("/actions")}>
      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "0 20px 124px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.52)", lineHeight: 1.55 }}>
          Your anonymous report helps JagaDuit AI identify repeated scam tactics and protect future users.
        </div>
        <div style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.24)", borderRadius: 14, padding: "11px 13px", color: "#fcd34d", fontSize: 12, lineHeight: 1.45 }}>
          Do not include passwords, OTPs, full account numbers, or sensitive personal information.
        </div>

        <Field label="Scam source">
          <select value={source} onChange={event => setSource(event.target.value)} style={inputStyle}>
            {SOURCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>

        <Field label="Scam type">
          <select value={scamType} onChange={event => setScamType(event.target.value)} style={inputStyle}>
            {SCAM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>

        <Field label="What happened?">
          <textarea
            value={summary}
            onChange={event => setSummary(event.target.value)}
            placeholder="Briefly describe what the scammer said or asked you to do..."
            rows={6}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }}
          />
        </Field>

        <Field label="Detected warning signs">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {indicators.length ? indicators.map(indicator => (
              <span key={indicator} style={{ padding: "7px 10px", borderRadius: 100, background: "rgba(244,63,94,0.14)", border: "1px solid rgba(244,63,94,0.28)", color: "#fca5a5", fontSize: 11, fontWeight: 700 }}>
                {indicatorLabel(indicator)}
              </span>
            )) : (
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>No warning signs pre-filled.</span>
            )}
          </div>
        </Field>

        {error && (
          <div style={{ background: "rgba(244,63,94,0.14)", border: "1px solid rgba(244,63,94,0.32)", borderRadius: 14, padding: "10px 12px", color: "#fca5a5", fontSize: 12 }}>
            {error}
          </div>
        )}
      </form>

      <FixedBar>
        <button onClick={handleSubmit} disabled={submitting || !summary.trim()} style={primaryButtonStyle(submitting || !summary.trim())}>
          {submitting ? "Submitting..." : "Submit anonymous report"}
        </button>
      </FixedBar>
    </PageShell>
  )
}

function PageShell({ title, onBack, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#05060a", color: "#fff", display: "flex", flexDirection: "column", fontFamily: "-apple-system, system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Anonymous community intelligence</div>
        </div>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function FixedBar({ children, gap = 0 }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(100vw, 430px)", padding: "16px 20px 34px", background: "rgba(10,10,16,0.88)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap }}>
      {children}
    </div>
  )
}

function buildAutofill(transferData, result) {
  const reasons = result.detected_red_flags || result.red_flags || result.reasons || []
  const source = normalizeSource(transferData.evidenceSource || transferData.paymentContext?.evidenceSource || transferData.paymentContext?.requestSource || "other")
  const indicators = inferIndicators(reasons, transferData.suspiciousMessage)
  return {
    evidenceSource: sourceValues.has(source) ? source : "other",
    scamType: inferScamType(reasons, transferData.suspiciousMessage, result.scam_type),
    summary: sanitizeSummary(transferData.suspiciousMessage || result.explanation || ""),
    indicators,
  }
}

function inferScamType(reasons, message, scamType) {
  const text = `${scamType || ""} ${reasons.join(" ")} ${message || ""}`.toLowerCase()
  if (text.includes("otp") || text.includes("password") || text.includes("tac")) return "otp_password_theft"
  if (text.includes("bank") || text.includes("account frozen") || text.includes("account suspended")) return "bank_impersonation"
  if (text.includes("police") || text.includes("lhdn") || text.includes("court") || text.includes("government")) return "government_impersonation"
  if (text.includes("investment") || text.includes("return") || text.includes("profit")) return "fake_investment"
  if (text.includes("parcel") || text.includes("delivery") || text.includes("courier")) return "fake_delivery"
  if (text.includes("marketplace") || text.includes("seller") || text.includes("buyer")) return "marketplace_scam"
  if (text.includes("romance") || text.includes("love")) return "romance_scam"
  if (text.includes("link") || text.includes("phishing")) return "phishing"
  return scamTypeValues.has(scamType) ? scamType : "other"
}

function normalizeSource(source) {
  if (source === "screenshot" || source === "image" || source === "ocr_screenshot") return "ocr"
  if (source === "transfer_before_payment" || source === "transfer") return "transfer_check"
  return source
}

function inferIndicators(reasons, message) {
  const text = `${reasons.join(" ")} ${message || ""}`.toLowerCase()
  const indicators = []
  addIf(indicators, "urgency", text.includes("urgent") || text.includes("immediately") || text.includes("now"))
  addIf(indicators, "secrecy", text.includes("do not tell") || text.includes("secret") || text.includes("confidential"))
  addIf(indicators, "account_frozen_claim", text.includes("account frozen") || text.includes("account suspended") || text.includes("unfreeze"))
  addIf(indicators, "immediate_transfer_request", text.includes("transfer now") || text.includes("send money now") || text.includes("transfer immediately"))
  addIf(indicators, "suspicious_link", text.includes("http") || text.includes("link") || text.includes("bit.ly"))
  addIf(indicators, "otp_password_request", text.includes("otp") || text.includes("tac") || text.includes("password"))
  addIf(indicators, "remote_access_request", text.includes("anydesk") || text.includes("teamviewer") || text.includes("remote access"))
  addIf(indicators, "unknown_recipient_account", text.includes("unknown") || text.includes("new receiver"))
  return indicators
}

function addIf(list, value, condition) {
  if (condition && !list.includes(value)) list.push(value)
}

function sanitizeSummary(value) {
  return String(value || "")
    .replace(/\b(?:otp|tac|password|passcode|pin)\s*[:=-]?\s*\S+/gi, "[redacted]")
    .replace(/\b\d{10,18}\b/g, "[redacted account]")
    .replace(/\b\d{6}\b/g, "[redacted code]")
    .slice(0, 600)
}

function amountRange(amount) {
  const value = Number(String(amount || "").replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(value) || value <= 0) return "unknown"
  if (value <= 100) return "RM1-RM100"
  if (value <= 500) return "RM100-RM500"
  if (value <= 1000) return "RM500-RM1000"
  if (value <= 3000) return "RM1000-RM3000"
  return "RM3000+"
}

function reportRiskLevel(result) {
  const level = String(result.risk_level || result.riskLevel || result.riskStatus || "").toUpperCase()
  if (level === "HIGH" || level === "UNSAFE" || level === "DANGER") return "DANGER"
  if (level === "MEDIUM" || level === "CAUTION") return "CAUTION"
  return level || "UNKNOWN"
}

function indicatorLabel(value) {
  return value.replace(/_/g, " ")
}

function primaryButtonStyle(disabled) {
  return {
    width: "100%",
    padding: 16,
    borderRadius: 16,
    background: disabled ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #a78bfa, #ec4899)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  }
}

const secondaryButtonStyle = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.72)",
  fontWeight: 700,
  fontSize: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  cursor: "pointer",
}
