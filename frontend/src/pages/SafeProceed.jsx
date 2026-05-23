import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

export default function SafeProceed() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult

  if (!result) { navigate("/transfer"); return null }

  // Backend returns both `score` (chat/call route) and `risk_score` (main route) — normalise here
  const score = result.score ?? result.risk_score ?? 0

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center", gap: 28 }}>
        {/* Checkmark circle */}
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: "rgba(52,211,153,0.12)", border: "2px solid rgba(52,211,153,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 48, lineHeight: 1, color: "#34d399" }}>✓</div>
        </div>

        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "#fff" }}>
            Safe to proceed
          </h2>
          <div style={{ fontSize: 14, color: "#34d399", fontWeight: 600, marginTop: 8, letterSpacing: ".02em" }}>
            Low risk · score {score}/100
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 10, lineHeight: 1.5, maxWidth: 260, margin: "10px auto 0" }}>
            Our AI analysis found no significant scam signals for this transfer.
          </div>
        </div>

        {/* Score bar */}
        <div style={{ width: "100%", maxWidth: 280, background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
            <span style={{ textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>Risk Score</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#34d399" }}>{score}/100</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${score}%`, background: "linear-gradient(90deg, #34d399, #10b981)", borderRadius: 100 }} />
          </div>
        </div>
      </div>

      {/* CTA Bar */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(100vw, 430px)", padding: "16px 20px 34px", background: "rgba(10,10,16,0.85)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => navigate("/success")}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: "linear-gradient(135deg, #10b981, #0891b2)", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" }}
        >
          Continue transfer
        </button>
        <button
          onClick={() => navigate("/actions")}
          style={{ width: "100%", padding: "13px 16px", borderRadius: 16, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)", fontWeight: 500, fontSize: 13, cursor: "pointer" }}
        >
          View safety tips
        </button>
      </div>
    </div>
  )
}
