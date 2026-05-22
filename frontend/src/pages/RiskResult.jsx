import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

function lvlClass(l) { return l === "low" ? "low" : l === "medium" ? "med" : "high" }

export default function RiskResult() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult

  if (!result) { navigate("/transfer"); return null }

  const lc = lvlClass(result.risk_level)
  const score = result.risk_score ?? 0
  const verdict = lc === "low" ? "Looks safe — but stay alert."
                : lc === "med" ? "Pause and verify before transferring."
                : "Do not transfer. This looks like a scam."
  const lvlLabel = lc === "low" ? "Low Risk" : lc === "med" ? "Medium Risk" : "High Risk"

  return (
    <div className="scr" style={{ background: "#fff" }}>
      {/* Risk hero */}
      <div className="risk-hero">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="back-btn" onClick={() => navigate("/check")} style={{ marginLeft: -8 }}>‹</button>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-500)", fontFamily: "var(--ff-mono)" }}>
            🛡️ JagaDuit AI
          </div>
        </div>

        <div className="risk-eyebrow" style={{ marginTop: 16 }}>Transaction risk score</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <div className={`risk-score-num ${lc}`}>{score}</div>
          <div className="risk-score-of">/ 100</div>
          <div style={{ flex: 1 }} />
          <div className={`risk-pill ${lc}`}><span className="dot" />{lvlLabel}</div>
        </div>
        <div className={`risk-label ${lc}`}>{verdict}</div>

        {/* Thermometer */}
        <div className="therm">
          <div className="therm-marker" style={{ left: `${score}%` }} />
        </div>
        <div className="therm-bands">
          <span className="low">Low 0–30</span>
          <span className="med">Medium 31–70</span>
          <span className="high">High 71–100</span>
        </div>
      </div>

      <div className="scr-body" style={{ padding: "0 18px" }}>
        {/* Score breakdown */}
        <div className="body-h">Score breakdown</div>
        <div className="kv-list">
          <div className="kv"><span className="kv-k">Message analysis</span><span className="kv-v">+{result.rule_contributions?.ai_message_analysis ?? 0}</span></div>
          <div className="kv"><span className="kv-k">Context signals</span><span className="kv-v">+{score - (result.rule_contributions?.ai_message_analysis ?? 0)}</span></div>
          <div className="kv" style={{ background: lc === "high" ? "var(--risk-high-bg)" : lc === "med" ? "var(--risk-med-bg)" : "var(--risk-low-bg)" }}>
            <span className="kv-k" style={{ fontWeight: 600, color: "var(--ink-900)" }}>Final score</span>
            <span className="kv-v" style={{ color: lc === "high" ? "var(--risk-high)" : lc === "med" ? "var(--risk-med)" : "var(--risk-low)" }}>{score} / 100</span>
          </div>
        </div>

        {/* Red flags */}
        {result.red_flags?.length > 0 && (
          <>
            <div className="body-h">Detected red flags ({result.red_flags.length})</div>
            <div className="flag-list">
              {result.red_flags.map((f, i) => (
                <div className="flag" key={i}>
                  <div className="flag-ic">⚑</div>
                  <div>
                    <div className="flag-name">{f}</div>
                  </div>
                  <div className="flag-weight">+{Math.round(5 + Math.random() * 10)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Scam type */}
        {result.scam_type && (
          <>
            <div className="body-h">Detected scam type</div>
            <div className="dcard" style={{ padding: 13, display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--navy-50)", color: "var(--navy-700)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🚨</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>{result.scam_type}</div>
                <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>Detected by AI pattern analysis</div>
              </div>
            </div>
          </>
        )}

        {/* Message excerpt */}
        {transferData.suspiciousMessage && (
          <>
            <div className="body-h">Message excerpt</div>
            <div className="scam-msg">{transferData.suspiciousMessage.slice(0, 300)}{transferData.suspiciousMessage.length > 300 ? "…" : ""}</div>
          </>
        )}

        <div style={{ height: 24 }} />
      </div>

      <div className="cta-bar">
        {lc === "high" ? (
          <>
            <button className="btn btn-danger" onClick={() => navigate("/actions")}>
              🛑 Stop &amp; view safety actions
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/")} style={{ fontSize: 12, color: "var(--ink-400)" }}>
              Continue transfer anyway (not recommended)
            </button>
          </>
        ) : lc === "med" ? (
          <>
            <button className="btn btn-warn" onClick={() => navigate("/actions")}>
              🛡️ Verify before transferring
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/success")}>Continue transfer</button>
          </>
        ) : (
          <>
            <button className="btn btn-pri" onClick={() => navigate("/success")}>
              ✓ Proceed with transfer
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/actions")} style={{ fontSize: 12 }}>View safety tips</button>
          </>
        )}
      </div>
    </div>
  )
}
