import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

const CFG = {
  low:    { icon: "✅", label: "Looks Safe",    labelColor: "var(--risk-low)",  bg: "var(--risk-low-bg)",  btnLabel: "Proceed with Transfer", btnClass: "btn-pri" },
  medium: { icon: "⚠️", label: "Be Careful",    labelColor: "var(--risk-med)",  bg: "var(--risk-med-bg)",  btnLabel: "Cancel Transfer",       btnClass: "btn-warn" },
  high:   { icon: "🚨", label: "Do Not Pay",    labelColor: "var(--risk-high)", bg: "var(--risk-high-bg)", btnLabel: "Cancel Transfer",       btnClass: "btn-danger" },
}

export default function TelegramResult() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult

  if (!result) { navigate("/transfer"); return null }

  const cfg = CFG[result.risk_level] || CFG.medium
  const topFlags = result.red_flags?.slice(0, 3) || []

  function handleAction() {
    if (result.risk_level === "low") navigate("/success")
    else navigate("/")
  }

  return (
    <div className="scr" style={{ background: "#fff" }}>
      <div className="scr-header">
        <button className="back-btn" onClick={() => navigate("/telegram")}>‹</button>
        <div style={{ flex: 1 }}>
          <div className="hdr-title">Telegram Scan Result</div>
          <div className="hdr-sub">{transferData.recipient || "Chat"} · AI analysis</div>
        </div>
      </div>

      <div className="scr-body" style={{ padding: "0 18px" }}>
        {/* Verdict card */}
        <div style={{ paddingTop: 16 }}>
          <div style={{ background: cfg.bg, borderRadius: "var(--r-lg)", padding: "28px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>{cfg.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: cfg.labelColor, letterSpacing: ".08em", textTransform: "uppercase" }}>{cfg.label}</div>
            {result.scam_type && <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", marginTop: 6 }}>{result.scam_type}</div>}

            {/* Score bar */}
            <div style={{ marginTop: 16, padding: "0 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-500)", marginBottom: 4 }}>
                <span>Risk score</span>
                <span style={{ fontFamily: "var(--ff-mono)", fontWeight: 600, color: "var(--ink-700)" }}>{result.risk_score}/100</span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,.6)", borderRadius: 100, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${result.risk_score}%`, background: cfg.labelColor, borderRadius: 100 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Red flags */}
        {topFlags.length > 0 && (
          <>
            <div className="body-h">Red flags</div>
            <div className="flag-list">
              {topFlags.map((f, i) => (
                <div className="flag" key={i}>
                  <div className="flag-ic">⚑</div>
                  <div><div className="flag-name">{f}</div></div>
                  <div />
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ height: 24 }} />
      </div>

      <div className="cta-bar">
        <button className={`btn ${cfg.btnClass}`} onClick={handleAction}>{cfg.btnLabel}</button>
        <button className="btn btn-sec" onClick={() => navigate("/actions")}>Ask a trusted contact</button>
      </div>
    </div>
  )
}
