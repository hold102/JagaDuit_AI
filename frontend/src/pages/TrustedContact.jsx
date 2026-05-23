import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { UserGroupIcon, ArrowRightIcon } from "../components/icons"

export default function TrustedContact() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult
  const [copied, setCopied] = useState(false)

  const message =
    result?.trusted_contact_message ||
    buildDefaultMessage(transferData)

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Share buttons are mock — navigator.share above handles the real share on mobile;
  // these buttons exist as visual affordance for the demo.
  const SHARE_APPS = ["WhatsApp", "Telegram", "SMS", "Email"]

  return (
    <div style={{ minHeight: "100vh", background: "#05060a", color: "#fff", display: "flex", flexDirection: "column", fontFamily: "-apple-system, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
            Ask a Trusted Contact
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            Get a second opinion before paying
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 120px" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20, lineHeight: 1.55 }}>
          Before you pay, send this message to a family member or friend for a second opinion.
        </div>

        {/* Message card */}
        <div style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Copy this message</div>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", fontSize: 13, color: "rgba(255,255,255,0.75)", whiteSpace: "pre-wrap", lineHeight: 1.6, marginBottom: 14 }}>
            {message}
          </div>
          <button
            onClick={handleCopy}
            style={{ width: "100%", padding: "13px 16px", borderRadius: 14, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            {copied ? "Copied!" : "Copy message"}
          </button>
        </div>

        {/* Share buttons */}
        <div style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Share via</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {SHARE_APPS.map((app) => (
              <button
                key={app}
                onClick={() => alert(`Open ${app} (mock demo)`)}
                style={{ padding: "12px 10px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                {app}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Bar */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(100vw, 430px)", padding: "16px 20px 34px", background: "rgba(10,10,16,0.85)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: "linear-gradient(135deg, #a78bfa, #ec4899)", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          Back
        </button>
        <button
          onClick={() => navigate("/transfer")}
          style={{ all: "unset", fontSize: 13, color: "rgba(255,255,255,0.35)", textAlign: "center", textDecoration: "underline", cursor: "pointer", padding: "4px 0" }}
        >
          Cancel transfer
        </button>
      </div>
    </div>
  )
}

function buildDefaultMessage(transferData) {
  const { recipient, amount, paymentContext, suspiciousMessage } = transferData
  return `Hi, I need your advice before I make a payment.

I received a message asking me to transfer RM ${amount || "???"} to "${recipient || "???"}".

The message says:
"${suspiciousMessage?.slice(0, 200) || ""}${suspiciousMessage?.length > 200 ? "…" : ""}"

It came via ${paymentContext?.requestSource || "unknown channel"} and felt ${paymentContext?.urgency || "urgent"}.

JagaDuit AI flagged this as potentially suspicious. Can you help me check if this looks legitimate?

— Checked with JagaDuit AI`
}
