import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

const SCAN_METHODS = [
  {
    title: "Telegram direct scan",
    subtitle: "Analyze Telegram conversation using the connected scan API.",
    evidenceSource: "telegram",
    route: "/telegram",
  },
  {
    title: "Phone call monitoring",
    subtitle: "Use voice scanner to detect pressure, urgency, and scam call patterns.",
    evidenceSource: "phone_call",
    route: "/voice",
  },
  {
    title: "Add scam evidence",
    subtitle: "Upload a screenshot or paste suspicious messages from WhatsApp, SMS, Email, Messenger, Instagram, or other apps.",
    evidenceSource: "other",
    route: "/chat-scan",
  },
]

export default function CheckBeforePay() {
  const navigate = useNavigate()
  const { setEvidenceSource } = useTransfer()

  function selectMethod(method) {
    setEvidenceSource(method.evidenceSource)
    navigate(method.route, { state: { evidenceSource: method.evidenceSource } })
  }

  return (
    <div className="scr">
      <div className="scr-header scr-header-dark">
        <button className="back-btn back-btn-dark" onClick={() => navigate("/transfer")}>{"<"}</button>
        <div style={{ flex: 1 }}>
          <div className="hdr-title hdr-title-white">JagaDuit Safety Check</div>
          <div className="hdr-sub hdr-sub-white">Pre-transfer protection</div>
        </div>
      </div>

      <div className="scr-body">
        <div style={{ padding: "18px 18px 0" }}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.015em", lineHeight: 1.25 }}>
            How should we check this transfer?
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6, lineHeight: 1.45 }}>
            Choose the scan method that matches the evidence you have.
          </div>
        </div>

        <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {SCAN_METHODS.map(method => (
            <button
              key={method.evidenceSource}
              type="button"
              onClick={() => selectMethod(method)}
              className="dcard"
              style={{
                all: "unset",
                boxSizing: "border-box",
                padding: "15px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)" }}>{method.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 3, lineHeight: 1.4 }}>
                  {method.subtitle}
                </div>
              </div>
              <span style={{ color: "var(--ink-400)", fontSize: 18 }}>{">"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
