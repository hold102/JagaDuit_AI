import { useNavigate } from "react-router-dom"

export default function TransferCancelled() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center", gap: 28 }}>
        {/* Shield icon */}
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: "rgba(167,139,250,0.12)", border: "2px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🛡️</div>
        </div>

        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "#fff" }}>
            Transfer stopped
          </h2>
          <div style={{ fontSize: 15, color: "#34d399", fontWeight: 600, marginTop: 10 }}>
            Your money is safe.
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 10, lineHeight: 1.5, maxWidth: 260, margin: "10px auto 0" }}>
            You made the right call. JagaDuit AI detected signs of a scam and protected your account.
          </div>
        </div>
      </div>

      {/* CTA Bar */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(100vw, 430px)", padding: "16px 20px 34px", background: "rgba(10,10,16,0.85)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
        <button
          onClick={() => navigate("/")}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: "linear-gradient(135deg, #a78bfa, #ec4899)", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
