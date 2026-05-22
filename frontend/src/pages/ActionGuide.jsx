import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

export default function ActionGuide() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult
  const [copied, setCopied] = useState(false)

  const msg = result?.trusted_contact_message || "Please help me verify this payment before I proceed."

  function copy() {
    navigator.clipboard?.writeText(msg).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const actions = result?.action_guide || []

  return (
    <div className="scr" style={{ background: "#fff" }}>
      <div className="scr-header">
        <div style={{ width: 32 }} />
        <div style={{ flex: 1 }}>
          <div className="hdr-title">Recommended actions</div>
          <div className="hdr-sub">Based on detected scam type</div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      <div className="scr-body" style={{ padding: "0 18px" }}>
        {/* NSRC */}
        <div style={{ paddingTop: 14 }}>
          <div className="nsrc">
            <div className="nsrc-ic">📞</div>
            <div className="nsrc-body">
              <div className="nsrc-title">Already transferred? Call NSRC</div>
              <div className="nsrc-num">997</div>
              <div className="nsrc-sub">National Scam Response Centre · 24/7</div>
            </div>
          </div>
        </div>

        {/* Action steps */}
        {actions.length > 0 && (
          <>
            <div className="body-h">Do this instead</div>
            <div className="dcard" style={{ padding: "4px 15px" }}>
              {actions.map((a, i) => (
                <div className="action-step" key={i}>
                  <div className="action-num">{i + 1}</div>
                  <div>
                    <div className="action-title">{a}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Trusted contact */}
        <div className="body-h">Get a second opinion</div>
        <div className="trusted-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--navy-700)", fontWeight: 600 }}>
              👥 Trusted contact message
            </div>
            <button onClick={copy} style={{ background: "#fff", border: "1px solid var(--navy-50)", color: "var(--navy-700)", padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontFamily: "var(--ff-sans)" }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <div className="trusted-preview">{msg}</div>
          <div style={{ marginTop: 7, fontSize: 11, color: "var(--ink-500)", display: "flex", alignItems: "center", gap: 5 }}>
            ℹ️ <span>Send this to a family member before any payment.</span>
          </div>
        </div>

        <div style={{ height: 24 }} />
      </div>

      <div className="cta-bar">
        <button className="btn btn-pri" onClick={() => navigate("/cancelled")}>
          ✕ Cancel this transfer
        </button>
        <button className="btn btn-sec" onClick={() => alert("Report sent (mock demo)")}>
          🚨 Report scam to my bank
        </button>
      </div>
    </div>
  )
}
