import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

const BANKS = ["Maybank", "CIMB Bank", "Public Bank", "RHB Bank", "Hong Leong Bank", "AmBank", "Bank Islam", "Bank Rakyat", "BSN", "Other"]

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

  function goSkip() {
    setTransferData(prev => ({ ...prev, recipient, accountNo, bank, amount, purpose }))
    navigate("/success")
  }

  const ready = recipient && accountNo && bank && amount

  return (
    <div className="scr" style={{ background: "#fff", position: "relative" }}>
      {/* Header */}
      <div className="scr-header">
        <button className="back-btn" onClick={() => navigate("/")} aria-label="Back">‹</button>
        <div style={{ flex: 1 }}>
          <div className="hdr-title">Transfer to other bank</div>
          <div className="hdr-sub">DuitNow · Step 2 of 3</div>
        </div>
      </div>

      <div className="scr-body">
        {/* Recipient */}
        <div className="field-grp">
          <div className="field-lbl">Recipient name</div>
          <input className="field-in" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="e.g. Ahmad bin Razali" />
        </div>

        <div className="field-grp">
          <div className="field-lbl">Account number</div>
          <input className="field-in mono" value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="e.g. 1234567890" inputMode="numeric" />
        </div>

        <div className="field-grp">
          <div className="field-lbl">Bank</div>
          <select className="field-in" value={bank} onChange={e => setBank(e.target.value)}>
            <option value="">Select bank…</option>
            {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="field-grp">
          <div className="field-lbl">Amount</div>
          <div className="amount-display">
            <div className="amount-cur">MYR</div>
            <input
              style={{ all: "unset", fontFamily: "var(--ff-mono)", fontSize: 36, fontWeight: 600, letterSpacing: "-.02em", color: "var(--ink-900)", display: "block", textAlign: "center", width: "100%", marginTop: 2 }}
              type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" min="0.01" step="0.01"
            />
            <div className="amount-sub">Daily limit remaining: RM 24,900.00</div>
          </div>
        </div>

        <div className="field-grp">
          <div className="field-lbl">Payment purpose</div>
          <input className="field-in" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Rental payment" />
        </div>

        <div className="field-grp" style={{ paddingBottom: 20 }}>
          <div className="field-lbl">From</div>
          <div className="field-static" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Savings · ····3104</span>
            <span style={{ color: "var(--ink-500)", fontFamily: "var(--ff-mono)", fontSize: 12 }}>RM 12,847.42</span>
          </div>
        </div>
      </div>

      <div className="cta-bar">
        <button className="btn btn-pri" onClick={handleContinue} disabled={!ready}>
          Continue <span style={{ fontSize: 16 }}>›</span>
        </button>
      </div>

      {/* AI Scan bottom sheet */}
      {showSheet && (
        <div className="sheet-overlay" onClick={() => setShowSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--navy-700)" }}>
                JagaDuit AI · Scam Detection
              </div>
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.015em", lineHeight: 1.25, marginTop: 10, color: "var(--ink-900)" }}>
              Scan this transfer with AI before you send.
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6, lineHeight: 1.5 }}>
              Choose Telegram direct scan, phone call monitoring, or add scam evidence.
            </div>

            <div style={{ height: 16 }} />

            {/* Primary scan entry */}
            <button className="btn btn-pri" onClick={() => { setShowSheet(false); goCheck() }}
              style={{ background: "var(--navy-800)", justifyContent: "flex-start", gap: 12, padding: "14px 16px" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>✨</div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>JagaDuit Safety Check</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.65)", fontWeight: 400, marginTop: 1 }}>Choose how to check this transfer</div>
              </div>
            </button>

            <div style={{ height: 8 }} />
            <button className="btn btn-ghost" onClick={goSkip} style={{ fontSize: 12, color: "var(--ink-400)", fontWeight: 500 }}>
              Skip — I'm confident this is safe
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
