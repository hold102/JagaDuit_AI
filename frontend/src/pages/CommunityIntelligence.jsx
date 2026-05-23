import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getScamReports } from "../utils/api"

export default function CommunityIntelligence() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    getScamReports()
      .then(data => setReports(data.reports || []))
      .catch(() => setError("Unable to load saved reports."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: "100vh", background: "#05060a", color: "#fff", display: "flex", flexDirection: "column", fontFamily: "-apple-system, system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>Community intelligence</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Prototype saved reports</div>
        </div>
      </div>

      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.24)", borderRadius: 14, padding: "12px 14px", color: "#c4b5fd", fontSize: 12, lineHeight: 1.45 }}>
          Demo database view. This shows sanitized community reports only. JagaDuit uses these as retrieval/rule-based signals, not model retraining.
        </div>

        {loading && <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Loading reports...</div>}
        {error && <div style={{ color: "#fca5a5", fontSize: 13 }}>{error}</div>}
        {!loading && reports.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>No saved reports yet.</div>
        )}

        {reports.map(report => (
          <div key={report.id} style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: "14px 15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{labelize(report.scam_type || "other")}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", marginTop: 2 }}>{labelize(report.evidence_source || "other")} · {formatDate(report.created_at)}</div>
              </div>
              <div style={{ fontFamily: "monospace", color: "#fca5a5", fontSize: 12, fontWeight: 800 }}>{report.risk_level || "UNKNOWN"} {report.risk_score}/100</div>
            </div>

            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 1.5 }}>
              {report.anonymized_summary || "No summary provided."}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {(report.detected_indicators || []).map(indicator => (
                <span key={indicator} style={{ padding: "5px 8px", borderRadius: 100, background: "rgba(244,63,94,0.13)", border: "1px solid rgba(244,63,94,0.24)", color: "#fca5a5", fontSize: 10, fontWeight: 700 }}>
                  {labelize(indicator)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function labelize(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase())
}

function formatDate(value) {
  if (!value) return "Unknown time"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
