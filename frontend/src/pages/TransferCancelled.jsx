import { useNavigate } from "react-router-dom"

export default function TransferCancelled() {
  const navigate = useNavigate()

  return (
    <div className="scr" style={{ background: "#fff" }}>
      <div className="verdict-stage">
        <div className="verdict-ic" style={{ background: "var(--gold-50)", color: "var(--gold-500)" }}>🛡️</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-.015em" }}>Transfer stopped. You're safe.</h2>
        <p style={{ fontSize: 13, color: "var(--ink-500)", margin: 0, lineHeight: 1.5 }}>
          JagaDuit AI prevented a high-risk transfer. Your money stays in your account.
        </p>

        <div className="dcard" style={{ padding: 15, marginTop: 22, width: "100%", textAlign: "left" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-500)", marginBottom: 10 }}>What we did</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              "Analyzed the message for scam patterns",
              "Calculated transaction risk score",
              "Activated cooling-off mode",
              "Cancelled the unsafe transfer",
            ].map(text => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--ink-700)" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--risk-low-bg)", color: "var(--risk-low)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 700 }}>✓</div>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="cta-bar">
        <button className="btn btn-pri" onClick={() => navigate("/")}>Back to home</button>
      </div>
    </div>
  )
}
