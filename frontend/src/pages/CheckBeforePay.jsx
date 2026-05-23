import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

const SCAN_METHODS = [
  { title: "Telegram",   icon: "✈️", sub: "Scan a Telegram chat with AI", evidenceSource: "telegram",   route: "/telegram" },
  { title: "Phone call", icon: "📞", sub: "Analyse a suspicious call",     evidenceSource: "phone_call", route: "/voice" },
  { title: "Chat / screenshot", icon: "💬", sub: "Paste text or upload a screenshot", evidenceSource: "other", route: "/chat-scan" },
]

export default function CheckBeforePay() {
  const navigate = useNavigate()
  const { setEvidenceSource } = useTransfer()

  function selectMethod(method) {
    setEvidenceSource(method.evidenceSource)
    navigate(method.route, { state: { evidenceSource: method.evidenceSource } })
  }

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button onClick={() => navigate("/transfer")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Safety Check</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 40px" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20, lineHeight: 1.5 }}>
          How did you receive the request to pay? Pick the source below and we will scan it for scam signals.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SCAN_METHODS.map(method => (
            <button
              key={method.evidenceSource}
              type="button"
              onClick={() => selectMethod(method)}
              style={{
                all: "unset",
                boxSizing: "border-box",
                padding: "18px 16px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                cursor: "pointer",
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(20px)",
                border: "0.5px solid rgba(255,255,255,0.12)",
                borderRadius: 20,
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{method.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{method.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{method.sub}</div>
              </div>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
