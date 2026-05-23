import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

export default function ActionGuide() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult
  const [copied, setCopied] = useState(false)
  const [showTips, setShowTips] = useState(false)

  const msg = result?.trusted_contact_message || "Please help me verify this payment before I proceed."
  const actions = result?.action_guide || []
  const riskScore = Number(result?.risk_score ?? result?.riskScore ?? result?.score ?? 0)
  const riskLevel = String(result?.risk_level || result?.riskLevel || result?.riskStatus || "").toLowerCase()
  const showReportAction = riskLevel === "high" || riskLevel === "danger" || riskLevel === "unsafe" || riskScore >= 70

  function copy() {
    navigator.clipboard?.writeText(msg).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // Use native share sheet on mobile (WhatsApp, SMS, Telegram etc.);
  // fall back to clipboard copy on desktop where navigator.share is unavailable.
  function shareToFamily() {
    if (navigator.share) {
      navigator.share({ text: msg }).catch(() => copy())
    } else {
      copy()
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Next steps</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 120px" }}>
        {/* NSRC 997 is Malaysia's National Scam Response Centre — the primary escalation hotline */}
        <a href="tel:997" style={{ textDecoration: "none", display: "block", marginBottom: 12 }}>
          <div style={{ background: "rgba(244,63,94,0.18)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 20, padding: "18px 18px", color: "#fff", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 32 }}>📞</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#fca5a5" }}>Already paid? Tap to call</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", marginTop: 2, letterSpacing: ".02em", color: "#fff" }}>NSRC 997</div>
            </div>
            <div style={{ fontSize: 22, color: "rgba(255,255,255,0.5)" }}>›</div>
          </div>
        </a>

        {showReportAction && (
          <button
            onClick={() => navigate("/report-scam")}
            style={{ all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", width: "100%", cursor: "pointer", background: "rgba(167,139,250,0.10)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(167,139,250,0.28)", borderRadius: 20, marginBottom: 12 }}
          >
            <div style={{ fontSize: 26 }}>⚑</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Report this scam pattern anonymously</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                Submit this case anonymously to help protect other Bank Islam users.
              </div>
            </div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.35)" }}>›</div>
          </button>
        )}

        {/* Share with family */}
        <button
          onClick={shareToFamily}
          style={{ all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", width: "100%", cursor: "pointer", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, marginBottom: 12 }}
        >
          <div style={{ fontSize: 26 }}>👥</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
              {copied ? "✓ Copied — paste & send to family" : "Share with family"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
              Tap to copy the message, then send it to a family member on WhatsApp or SMS
            </div>
          </div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.3)" }}>›</div>
        </button>

        {/* Safety tips */}
        {actions.length > 0 && (
          <>
            <button
              onClick={() => setShowTips(s => !s)}
              style={{ all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", width: "100%", cursor: "pointer", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, marginBottom: 8 }}
            >
              <div style={{ fontSize: 26 }}>💡</div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#fff" }}>Safety tips</div>
              <div style={{ fontSize: 18, color: "rgba(255,255,255,0.3)", transform: showTips ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</div>
            </button>

            {showTips && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "12px 16px", marginBottom: 8 }}>
                {actions.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: i < actions.length - 1 ? "0.5px solid rgba(255,255,255,0.08)" : "none" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(167,139,250,0.2)", color: "#c4b5fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{a}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {copied && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(167,139,250,0.12)", border: "0.5px solid rgba(167,139,250,0.3)", borderRadius: 100, fontSize: 11, color: "#c4b5fd", fontFamily: "monospace", textAlign: "center" }}>
            Message in clipboard
          </div>
        )}
        <pre style={{ display: "none" }}>{msg}</pre>
      </div>

      {/* CTA Bar */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(100vw, 430px)", padding: "16px 20px 34px", background: "rgba(10,10,16,0.85)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
        <button
          onClick={() => navigate("/cancelled")}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: "rgba(244,63,94,0.2)", border: "1px solid rgba(244,63,94,0.4)", color: "#fca5a5", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
        >
          ✕ Cancel transfer
        </button>
      </div>
    </div>
  )
}
