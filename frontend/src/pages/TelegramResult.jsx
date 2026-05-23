import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

// CFG table drives all visual variants (colour, icon, CTA label) from risk_level —
// adding a new level only requires a new entry here rather than scattered if-blocks.
const CFG = {
  low: {
    icon: "✅",
    label: "Looks Safe",
    labelColor: "#34d399",
    cardBg: "rgba(52,211,153,0.08)",
    cardBorder: "rgba(52,211,153,0.25)",
    barColor: "#34d399",
    btnLabel: "Proceed with Transfer",
    btnBg: "linear-gradient(135deg, #10b981, #0891b2)",
    btnColor: "#fff",
  },
  medium: {
    icon: "⚠️",
    label: "Be Careful",
    labelColor: "#f59e0b",
    cardBg: "rgba(245,158,11,0.08)",
    cardBorder: "rgba(245,158,11,0.25)",
    barColor: "#f59e0b",
    btnLabel: "Cancel Transfer",
    btnBg: "rgba(245,158,11,0.15)",
    btnColor: "#fcd34d",
  },
  high: {
    icon: "🚨",
    label: "Do Not Pay",
    labelColor: "#f43f5e",
    cardBg: "rgba(244,63,94,0.08)",
    cardBorder: "rgba(244,63,94,0.3)",
    barColor: "#f43f5e",
    btnLabel: "Cancel Transfer",
    btnBg: "rgba(244,63,94,0.18)",
    btnColor: "#fca5a5",
  },
}

export default function TelegramResult() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult

  if (!result) { navigate("/transfer"); return null }

  // Fall back to medium config if risk_level is missing or unknown
  const riskLevel = String(result.risk_level || "").toLowerCase()
  const cfg = CFG[riskLevel] || CFG.medium
  // Show at most 3 flags to keep the screen readable on a phone
  const topFlags = result.red_flags?.slice(0, 3) || []

  function handleAction() {
    if (riskLevel === "low") navigate("/success")
    else navigate("/")
  }

  return (
    <div style={{ minHeight: "100vh", background: "#05060a", color: "#fff", display: "flex", flexDirection: "column", fontFamily: "-apple-system, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button onClick={() => navigate("/telegram")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Telegram Scan Result</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{transferData.recipient || "Chat"} · AI analysis</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 120px" }}>
        {/* Verdict card */}
        <div style={{ background: cfg.cardBg, border: `1px solid ${cfg.cardBorder}`, borderRadius: 20, padding: "28px 20px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{cfg.icon}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: cfg.labelColor, letterSpacing: ".08em", textTransform: "uppercase" }}>{cfg.label}</div>
          {result.scam_type && (
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginTop: 8 }}>{result.scam_type}</div>
          )}

          {/* Score bar */}
          <div style={{ marginTop: 20, padding: "0 8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
              <span style={{ textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>Risk score</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: cfg.labelColor }}>{result.risk_score}/100</span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${result.risk_score}%`, background: cfg.barColor, borderRadius: 100 }} />
            </div>
          </div>
        </div>

        {/* Red flags */}
        {topFlags.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Red flags</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topFlags.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(244,63,94,0.15)", border: "0.5px solid rgba(244,63,94,0.35)", color: "#f43f5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>⚑</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.45 }}>{f}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA Bar */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(100vw, 430px)", padding: "16px 20px 34px", background: "rgba(10,10,16,0.85)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={handleAction}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: cfg.btnBg, color: cfg.btnColor, fontWeight: 700, fontSize: 16, border: riskLevel === "low" ? "none" : `1px solid ${cfg.cardBorder}`, cursor: "pointer" }}
        >
          {cfg.btnLabel}
        </button>
        <button
          onClick={() => navigate("/actions")}
          style={{ width: "100%", padding: "13px 16px", borderRadius: 16, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)", fontWeight: 500, fontSize: 14, cursor: "pointer" }}
        >
          Ask a trusted contact
        </button>
      </div>
    </div>
  )
}
