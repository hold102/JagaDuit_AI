import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

const BANKS = ["Maybank", "CIMB Bank", "Public Bank", "RHB Bank", "Hong Leong Bank", "AmBank", "Bank Islam", "Bank Rakyat", "BSN", "Other"]

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  color: "#fff",
  padding: "14px 16px",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  colorScheme: "dark",
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: "rgba(255,255,255,0.5)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: 8,
  display: "block",
}

export default function TransferFlow() {
  const navigate = useNavigate()
  const { setTransferData } = useTransfer()

  const [recipient, setRecipient] = useState("")
  const [accountNo, setAccountNo] = useState("")
  const [bank, setBank]           = useState("")
  const [amount, setAmount]       = useState("")
  const [purpose, setPurpose]     = useState("Family support")
  const [showSheet, setShowSheet] = useState(false)

  function handleContinue(e) {
    e.preventDefault()
    setShowSheet(true)
  }

  function goCheck() {
    setTransferData(prev => ({ ...prev, recipient, accountNo, bank, amount, purpose }))
    navigate("/check")
  }

  // Skipping the safety check is intentionally allowed — the app nudges but does not block transfers
  function goSkip() {
    setTransferData(prev => ({ ...prev, recipient, accountNo, bank, amount, purpose }))
    navigate("/success")
  }

  const ready = recipient && accountNo && bank && amount

  return (
    <div style={{ minHeight: "100vh", background: "#05060a", color: "#fff", display: "flex", flexDirection: "column", fontFamily: "-apple-system, system-ui, sans-serif", position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button onClick={() => navigate("/")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Transfer to other bank</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>DuitNow · Step 2 of 3</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Recipient name</label>
            <input style={inputStyle} value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="e.g. Ahmad bin Razali" />
          </div>

          <div>
            <label style={labelStyle}>Account number</label>
            <input style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.04em" }} value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="e.g. 1234567890" inputMode="numeric" />
          </div>

          <div>
            <label style={labelStyle}>Bank</label>
            <select style={{ ...inputStyle, colorScheme: "dark" }} value={bank} onChange={e => setBank(e.target.value)}>
              <option value="">Select bank…</option>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Amount</label>
            <div style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "20px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>MYR</div>
              <input
                style={{ all: "unset", fontFamily: "monospace", fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", color: "#fff", display: "block", textAlign: "center", width: "100%", marginTop: 2 }}
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" min="0.01" step="0.01"
              />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>Daily limit remaining: RM 24,900.00</div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Payment purpose</label>
            <input style={inputStyle} value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Rental payment" />
          </div>

          <div>
            <label style={labelStyle}>From</label>
            <div style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.8)" }}>Savings · ····3104</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace", fontSize: 12 }}>RM 12,847.42</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Bar */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(100vw, 430px)", padding: "16px 20px 34px", background: "rgba(10,10,16,0.85)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
        <button
          onClick={handleContinue}
          disabled={!ready}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: ready ? "linear-gradient(135deg, #a78bfa, #ec4899)" : "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: ready ? "pointer" : "not-allowed", opacity: ready ? 1 : 0.5 }}
        >
          Continue ›
        </button>
      </div>

      {/* Bottom Sheet */}
      {showSheet && (
        <div
          onClick={() => setShowSheet(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", background: "rgba(18,18,28,0.98)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: "24px 24px 0 0", padding: "20px 20px 48px", display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 16px" }} />

            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.015em", color: "#fff", marginBottom: 8 }}>
              Scan before sending?
            </div>

            <button
              onClick={() => { setShowSheet(false); goCheck() }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 16, background: "linear-gradient(135deg, #a78bfa, #ec4899)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}
            >
              ✨ Run Safety Check
            </button>

            <button
              onClick={goSkip}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 16, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.55)", fontWeight: 500, fontSize: 13, cursor: "pointer" }}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
