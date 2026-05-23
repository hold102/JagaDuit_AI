import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

function normalizeLevel(result) {
  if (result.riskLevel === "SAFE") return "low"
  if (result.riskLevel === "CAUTION") return "medium"
  if (result.riskLevel === "DANGER") return "high"
  return result.risk_level || "medium"
}

function lvlClass(level) {
  return level === "low" ? "low" : level === "medium" ? "med" : "high"
}

export default function RiskResult() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult

  if (!result) { navigate("/transfer"); return null }

  const level = normalizeLevel(result)
  const lc = lvlClass(level)
  const score = result.score ?? result.risk_score ?? 0
  const redFlags = result.reasons || result.red_flags || []
  const scamType = result.scamType || result.scam_type
  const verdict = result.recommendedAction || (
    lc === "low" ? "Looks safe - but stay alert."
      : lc === "med" ? "Pause and verify before transferring."
      : "Do not transfer. This looks like a scam."
  )
  const lvlLabel = result.riskLevel || (lc === "low" ? "Low Risk" : lc === "med" ? "Medium Risk" : "High Risk")

  return (
    <div className="scr" style={{ background: "#fff" }}>
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

        <div className="therm">
          <div className="therm-marker" style={{ left: `${score}%` }} />
        </div>
        <div className="therm-bands">
          <span className="low">Low 0-30</span>
          <span className="med">Medium 31-70</span>
          <span className="high">High 71-100</span>
        </div>
      </div>

      <div className="scr-body" style={{ padding: "0 18px" }}>
        {result.otp_solicitation_detected && (
          <div style={{ background: "var(--risk-high)", color: "#fff", borderRadius: 12, padding: "14px 16px", margin: "16px 0", boxShadow: "0 4px 12px rgba(229,57,53,.25)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>⚠ DO NOT SHARE YOUR OTP / TAC</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.95 }}>
              {result.otp_alert?.message ||
               "This message asks you to share a one-time passcode. Real banks and agencies will NEVER ask for this."}
            </div>
            {result.otp_alert?.matched_text && (
              <div style={{ fontSize: 11, fontFamily: "var(--ff-mono)", marginTop: 6, opacity: 0.8 }}>
                Detected: "{result.otp_alert.matched_text}"
              </div>
            )}
          </div>
        )}

        {result.app_download_detected && (
          <div style={{ background: "var(--risk-high)", color: "#fff", borderRadius: 12, padding: "14px 16px", margin: "16px 0", boxShadow: "0 4px 12px rgba(229,57,53,.25)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>⚠ DO NOT INSTALL ANY APP</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.95 }}>
              {result.app_download_alert?.message ||
               "This message asks you to install a remote-access app. No real bank or agency will ever ask this."}
            </div>
            {result.app_download_alert?.app_name && (
              <div style={{ fontSize: 11, fontFamily: "var(--ff-mono)", marginTop: 6, opacity: 0.8 }}>
                Detected: "{result.app_download_alert.app_name}"
              </div>
            )}
          </div>
        )}

        <div className="body-h">Score breakdown</div>
        <div className="kv-list">
          <div className="kv"><span className="kv-k">Message analysis</span><span className="kv-v">+{result.rule_contributions?.ai_message_analysis ?? score}</span></div>
          <div className="kv"><span className="kv-k">Context signals</span><span className="kv-v">+{result.rule_contributions ? score - (result.rule_contributions.ai_message_analysis ?? 0) : 0}</span></div>
          <div className="kv" style={{ background: lc === "high" ? "var(--risk-high-bg)" : lc === "med" ? "var(--risk-med-bg)" : "var(--risk-low-bg)" }}>
            <span className="kv-k" style={{ fontWeight: 600, color: "var(--ink-900)" }}>Final score</span>
            <span className="kv-v" style={{ color: lc === "high" ? "var(--risk-high)" : lc === "med" ? "var(--risk-med)" : "var(--risk-low)" }}>{score} / 100</span>
          </div>
        </div>

        {redFlags.length > 0 && (
          <>
            <div className="body-h">Detected red flags ({redFlags.length})</div>
            <div className="flag-list">
              {redFlags.map((flag, i) => (
                <div className="flag" key={i}>
                  <div className="flag-ic">⚑</div>
                  <div>
                    <div className="flag-name">{flag}</div>
                  </div>
                  <div className="flag-weight">+{5 + (i % 4) * 3}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {result.behavior && result.behavior.level !== "low" && result.behavior.anomalies?.length > 0 && (
          <>
            <div className="body-h">Unusual activity for your account</div>
            <div className="dcard" style={{
              padding: 14,
              borderLeft: `4px solid ${result.behavior.level === "high" ? "var(--risk-high)" : "var(--risk-med)"}`,
              background: result.behavior.level === "high" ? "var(--risk-high-bg)" : "var(--risk-med-bg)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{result.behavior.level === "high" ? "⚠" : "ℹ"}</span>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: result.behavior.level === "high" ? "var(--risk-high)" : "var(--risk-med)",
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                }}>
                  {result.behavior.level === "high" ? "High anomaly" : "Some unusual signals"}
                  <span style={{ marginLeft: 8, fontFamily: "var(--ff-mono)", opacity: 0.7 }}>
                    score {result.behavior.score}/100
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-900)", marginBottom: 8, lineHeight: 1.4 }}>
                {result.behavior.summary}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ink-700)", lineHeight: 1.55 }}>
                {result.behavior.anomalies.map((a, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>{a}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {scamType && (
          <>
            <div className="body-h">Detected scam type</div>
            <div className="dcard" style={{ padding: 13, display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--navy-50)", color: "var(--navy-700)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🚨</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>{scamType}</div>
                <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>Detected by AI pattern analysis</div>
              </div>
            </div>
          </>
        )}

        {transferData.suspiciousMessage && (
          <>
            <div className="body-h">Message excerpt</div>
            <div className="scam-msg">{transferData.suspiciousMessage.slice(0, 300)}{transferData.suspiciousMessage.length > 300 ? "..." : ""}</div>
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
