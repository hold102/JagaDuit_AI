import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

const DURATION = 10

export default function CoolingOff() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult

  const [remaining, setRemaining] = useState(DURATION)

  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  if (!result) { navigate("/transfer"); return null }

  const pct = (DURATION - remaining) / DURATION
  const C = 2 * Math.PI * 18

  return (
    <div className="cooling">
      <div style={{ flex: 1, padding: "80px 24px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div className="cooling-icon">
          <span style={{ fontSize: 34, lineHeight: 1 }}>🛑</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--risk-high)", marginBottom: 8 }}>
          Cooling-Off Mode Active
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px", letterSpacing: "-.015em", color: "var(--ink-900)" }}>
          Stop. Do not transfer.
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-700)", lineHeight: 1.5, maxWidth: 280, margin: 0 }}>
          JagaDuit AI detected high scam risk on this payment.
          Take {DURATION} seconds to think — most scam victims realise within seconds when given the chance.
        </p>
      </div>

      {/* Countdown card */}
      <div className="countdown-card">
        {/* SVG ring */}
        <div style={{ width: 44, height: 44, flexShrink: 0 }}>
          <svg viewBox="0 0 44 44" width="44" height="44" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--ink-100)" strokeWidth="3" />
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--risk-high)" strokeWidth="3"
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
              style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>
            {remaining > 0 ? `Please wait ${remaining}s` : "You can now proceed"}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>
            {remaining > 0 ? "Use this pause to ask a family member." : "Tap below to view safe next steps."}
          </div>
        </div>
        <div className="countdown-num">{remaining > 0 ? `${remaining}s` : "✓"}</div>
      </div>

      {/* Reminders */}
      <div style={{ padding: "0 18px" }}>
        <div className="dcard" style={{ padding: 13, display: "flex", gap: 10, alignItems: "flex-start", background: "var(--navy-25)", borderColor: "var(--navy-50)" }}>
          <span style={{ fontSize: 14, marginTop: 1 }}>ℹ️</span>
          <div style={{ fontSize: 12, color: "var(--navy-800)", lineHeight: 1.45 }}>
            <strong style={{ display: "block", marginBottom: 3 }}>Quick reminders</strong>
            <ul style={{ margin: "0", padding: "0 0 0 16px", color: "var(--ink-700)" }}>
              <li style={{ marginBottom: 2 }}>Real banks never request TAC or PIN via message.</li>
              <li style={{ marginBottom: 2 }}>Account freeze warnings from links are not real.</li>
              <li>Call the official hotline printed on your card.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="cta-bar">
        <button className="btn btn-danger" disabled={remaining > 0} onClick={() => navigate("/actions")}>
          {remaining > 0 ? `View safety actions in ${remaining}s` : "🛡️ View safety actions"}
        </button>
      </div>
    </div>
  )
}
