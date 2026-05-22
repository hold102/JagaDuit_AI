import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

function fmt(n) {
  return Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TransferSuccess() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()

  return (
    <div className="scr" style={{ background: "#fff" }}>
      <div className="verdict-stage">
        <div className="verdict-ic">✓</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-.015em" }}>Transfer sent</h2>
        <p style={{ fontSize: 13, color: "var(--ink-500)", margin: 0, lineHeight: 1.5 }}>
          Your transfer to <strong style={{ color: "var(--ink-900)" }}>{transferData.recipient || "recipient"}</strong> is on the way.
        </p>

        <div style={{ width: "100%", marginTop: 22 }}>
          <div className="kv-list">
            <div className="kv"><span className="kv-k">Amount</span><span className="kv-v">RM {fmt(transferData.amount || 0)}</span></div>
            <div className="kv"><span className="kv-k">Reference</span><span className="kv-v">TXN{Math.floor(Math.random()*9000+1000)}</span></div>
            <div className="kv"><span className="kv-k">JagaDuit check</span><span className="kv-v" style={{ fontFamily: "var(--ff-sans)", color: "var(--risk-low)" }}>✓ Cleared</span></div>
            <div className="kv"><span className="kv-k">Estimated arrival</span><span className="kv-v" style={{ fontFamily: "var(--ff-sans)" }}>Instant</span></div>
          </div>
        </div>
      </div>
      <div className="cta-bar">
        <button className="btn btn-pri" onClick={() => navigate("/")}>Done</button>
      </div>
    </div>
  )
}
