import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

// 10-second cooling-off in the UI (backend reports 30 s — the frontend enforces the shorter
// interactive pause; users are still nudged to call NSRC 997 before the button unlocks).
const DURATION = 10

export default function CoolingOff() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult

  const [remaining, setRemaining] = useState(DURATION)

  // Re-run the effect each time remaining changes — chains 1-second ticks without setInterval
  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  if (!result) { navigate("/transfer"); return null }

  const pct = (DURATION - remaining) / DURATION
  const R = 80
  const STROKE = 6
  const RING_C = 2 * Math.PI * R

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center", gap: 28 }}>
        <div style={{ fontSize: 48, lineHeight: 1 }}>🛑</div>

        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "#fff" }}>
            Stop
          </h2>
          <div style={{ fontSize: 14, color: "#f43f5e", fontWeight: 600, marginTop: 8, letterSpacing: ".02em" }}>
            High scam risk detected
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 8, lineHeight: 1.5, maxWidth: 260, margin: "8px auto 0" }}>
            Please wait before proceeding. Take this time to verify the request with someone you trust.
          </div>
        </div>

        {/* Countdown ring */}
        <div style={{ position: "relative", width: R * 2 + STROKE * 2, height: R * 2 + STROKE * 2 }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${R * 2 + STROKE * 2} ${R * 2 + STROKE * 2}`} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={R + STROKE} cy={R + STROKE} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} />
            <circle
              cx={R + STROKE} cy={R + STROKE} r={R}
              fill="none"
              stroke="#f43f5e"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - pct)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: remaining > 0 ? 56 : 40, fontWeight: 700, color: remaining > 0 ? "#fff" : "#34d399" }}>
            {remaining > 0 ? remaining : "✓"}
          </div>
        </div>

        {remaining > 0 && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
            {remaining}s remaining
          </div>
        )}
      </div>

      {/* CTA Bar */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(100vw, 430px)", padding: "16px 20px 34px", background: "rgba(10,10,16,0.85)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
        <button
          disabled={remaining > 0}
          onClick={() => navigate("/actions")}
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 16,
            background: remaining > 0 ? "rgba(255,255,255,0.06)" : "rgba(244,63,94,0.85)",
            color: remaining > 0 ? "rgba(255,255,255,0.35)" : "#fff",
            fontWeight: 700,
            fontSize: 16,
            border: remaining > 0 ? "0.5px solid rgba(255,255,255,0.1)" : "none",
            cursor: remaining > 0 ? "not-allowed" : "pointer",
            transition: "all .3s",
          }}
        >
          {remaining > 0 ? `Wait ${remaining}s…` : "Continue"}
        </button>
      </div>
    </div>
  )
}
