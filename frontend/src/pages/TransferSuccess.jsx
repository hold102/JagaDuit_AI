import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

function fmt(n) {
  return Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function makeReference(transferData) {
  const seed = `${transferData.recipient || "recipient"}-${transferData.amount || "0"}`
  const hash = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return `TXN${String((hash % 9000) + 1000).padStart(4, "0")}`
}

export default function TransferSuccess() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const reference = makeReference(transferData)

  const rows = [
    { key: "Amount", value: `RM ${fmt(transferData.amount || 0)}`, mono: true },
    { key: "To", value: transferData.recipient || "recipient" },
    { key: "Reference", value: reference, mono: true },
    { key: "JagaDuit check", value: "✓ Cleared", green: true },
    { key: "Estimated arrival", value: "Instant" },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#05060a", color: "#fff", display: "flex", flexDirection: "column", fontFamily: "-apple-system, system-ui, sans-serif" }}>
      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center", gap: 24 }}>
        {/* Checkmark */}
        <div style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(52,211,153,0.12)", border: "2px solid rgba(52,211,153,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 40, lineHeight: 1, color: "#34d399" }}>✓</div>
        </div>

        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "#fff" }}>
            Transfer sent
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "8px 0 0", lineHeight: 1.55 }}>
            Your transfer to <strong style={{ color: "#fff" }}>{transferData.recipient || "recipient"}</strong> is on the way.
          </p>
        </div>

        {/* KV card */}
        <div style={{ width: "100%", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, overflow: "hidden" }}>
          {rows.map((row, i) => (
            <div
              key={row.key}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderBottom: i < rows.length - 1 ? "0.5px solid rgba(255,255,255,0.07)" : "none" }}
            >
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{row.key}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: row.green ? "#34d399" : "#fff", fontFamily: row.mono ? "monospace" : "inherit", letterSpacing: row.mono ? "0.02em" : 0 }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 20px 34px", background: "rgba(10,10,16,0.85)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
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
