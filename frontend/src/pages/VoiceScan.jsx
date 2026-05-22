import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"

const WS_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000")
  .replace(/^http/, "ws") + "/api/voice/scan"

const SIGNALS = [
  { key: "impersonation_detected", label: "Impersonation",   icon: "👤" },
  { key: "emotional_pressure",     label: "Urgency / Pressure", icon: "⚡" },
  { key: "suspicious_link",        label: "Suspicious Link",  icon: "🔗" },
]

function RiskColor(level) {
  return level === "high" ? "var(--risk-high)" : level === "medium" ? "var(--risk-med)" : "var(--risk-low)"
}

export default function VoiceScan() {
  const navigate = useNavigate()

  const [listening, setListening]       = useState(false)
  const [supported, setSupported]       = useState(true)
  const [lastSentence, setLastSentence] = useState("")   // most recent final sentence
  const [interimText, setInterimText]   = useState("")   // words being spoken right now
  const [analysis, setAnalysis]         = useState(null)
  const [wsStatus, setWsStatus]         = useState("idle")
  const [callDuration, setCallDuration] = useState(0)

  const wsRef          = useRef(null)
  const recogRef       = useRef(null)
  const accumulatedRef = useRef("")
  const timerRef       = useRef(null)
  const sendTimerRef   = useRef(null)

  // Check browser support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) setSupported(false)
  }, [])


  function connectWS() {
    const ws = new WebSocket(WS_URL)
    ws.onopen  = () => setWsStatus("connected")
    ws.onerror = () => setWsStatus("error")
    ws.onclose = () => setWsStatus("idle")
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.status === "analyzed") setAnalysis(data)
    }
    wsRef.current = ws
  }

  function sendToBackend(accumulated) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ accumulated }))
    }
  }

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    connectWS()

    const recog = new SR()
    recog.continuous      = true
    recog.interimResults  = true
    recog.lang            = "en-US"

    recog.onresult = (e) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim()
        if (e.results[i].isFinal) {
          accumulatedRef.current += " " + text
          setLastSentence(text)   // show only this sentence
          setInterimText("")
          clearTimeout(sendTimerRef.current)
          sendTimerRef.current = setTimeout(() => {
            sendToBackend(accumulatedRef.current.trim())
          }, 4000)
        } else {
          interim = text
        }
      }
      setInterimText(interim)
    }

    recog.onerror = (e) => {
      if (e.error !== "no-speech") console.error("Speech error:", e.error)
    }

    recog.onend = () => {
      // Auto-restart if still listening
      if (recogRef.current === recog && listening) {
        try { recog.start() } catch (_) {}
      }
    }

    recog.start()
    recogRef.current = recog

    // Call duration timer
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)

    setListening(true)
    setLastSentence("")
    setInterimText("")
    setAnalysis(null)
    accumulatedRef.current = ""
  }, [listening])

  function stopListening() {
    recogRef.current?.stop()
    recogRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    clearInterval(timerRef.current)
    clearTimeout(sendTimerRef.current)
    setListening(false)
    setInterimText("")
    setCallDuration(0)
    // Final send before closing
    if (accumulatedRef.current.trim().length > 30) {
      sendToBackend(accumulatedRef.current.trim())
    }
  }

  function formatTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
  }

  const riskLevel = analysis?.risk_level
  const riskScore = analysis?.risk_score ?? 0
  const riskColor = riskLevel ? RiskColor(riskLevel) : "var(--ink-300)"
  const activeSignals = SIGNALS.filter(s => analysis?.[s.key])

  // Not supported
  if (!supported) {
    return (
      <div className="scr" style={{ background: "#fff" }}>
        <div className="scr-header">
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          <div className="hdr-title">Voice Call Scanner</div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", gap: 12 }}>
          <div style={{ fontSize: 40 }}>😞</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)" }}>Browser not supported</div>
          <div style={{ fontSize: 13, color: "var(--ink-500)", lineHeight: 1.5 }}>
            Voice scanning requires Google Chrome or Microsoft Edge. Please open this app in one of those browsers.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="scr" style={{ background: listening ? "#0a1f3d" : "#fff", transition: "background .4s" }}>
      {/* Header */}
      <div className="scr-header" style={{ background: listening ? "var(--navy-900)" : "#fff", borderBottomColor: listening ? "rgba(255,255,255,.08)" : "var(--ink-100)", transition: "background .4s" }}>
        <button className="back-btn" onClick={() => { stopListening(); navigate(-1) }}
          style={{ color: listening ? "rgba(255,255,255,.8)" : "var(--ink-700)" }}>‹</button>
        <div style={{ flex: 1 }}>
          <div className="hdr-title" style={{ color: listening ? "#fff" : "var(--ink-900)" }}>📞 Voice Call Scanner</div>
          <div className="hdr-sub" style={{ color: listening ? "rgba(255,255,255,.5)" : "var(--ink-500)" }}>
            {listening ? `Monitoring · ${formatTime(callDuration)}` : "Real-time scam detection"}
          </div>
        </div>
        {listening && wsStatus === "connected" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,.6)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--risk-low)", animation: "pulse 1.5s ease-in-out infinite" }} />
            LIVE
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
          </div>
        )}
      </div>

      <div className="scr-body">
        {/* Idle state */}
        {!listening && (
          <div style={{ padding: "40px 24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--navy-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>📞</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-900)", letterSpacing: "-.015em" }}>Received a suspicious call?</div>
              <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6, lineHeight: 1.5 }}>
                Put the caller on speaker, then tap Start. AI listens in real-time and flags scam patterns as they speak.
              </div>
            </div>

            {/* How it works */}
            <div style={{ width: "100%", textAlign: "left", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { n: "1", t: "Put caller on speaker", d: "So your phone mic can pick up both sides" },
                { n: "2", t: "Tap Start Monitoring",  d: "AI begins listening and transcribing live" },
                { n: "3", t: "Watch for alerts",      d: "Risk signals appear as the call progresses" },
              ].map(({ n, t, d }) => (
                <div key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--navy-50)", color: "var(--navy-800)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--ff-mono)", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{n}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>{t}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "var(--ink-400)", padding: "10px 16px", background: "var(--ink-50)", borderRadius: "var(--r-md)", lineHeight: 1.5, width: "100%" }}>
              ⚠️ Works best on Chrome or Edge. Speech is processed locally — audio is never uploaded.
            </div>
          </div>
        )}

        {/* Listening state */}
        {listening && (
          <div style={{ padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Risk meter */}
            <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "var(--r-lg)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,.5)" }}>Risk Score</div>
                {riskLevel && (
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", padding: "3px 9px", borderRadius: 100, background: riskColor + "22", color: riskColor }}>
                    {riskLevel === "low" ? "Low Risk" : riskLevel === "medium" ? "Medium Risk" : "High Risk"}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <div style={{ fontFamily: "var(--ff-mono)", fontSize: 44, fontWeight: 600, color: riskColor, transition: "color .4s", lineHeight: 1 }}>{riskScore}</div>
                <div style={{ fontFamily: "var(--ff-mono)", fontSize: 16, color: "rgba(255,255,255,.3)" }}>/ 100</div>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,.1)", borderRadius: 100, marginTop: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${riskScore}%`, background: riskColor, borderRadius: 100, transition: "width .6s, background .4s" }} />
              </div>
              {analysis?.scam_type && (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 500 }}>
                  Detected: <span style={{ color: riskColor }}>{analysis.scam_type}</span>
                </div>
              )}
              {!analysis && (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.4)", fontFamily: "var(--ff-mono)" }}>Listening for patterns…</div>
              )}
            </div>

            {/* Signal badges */}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {SIGNALS.map(({ key, label, icon }) => {
                const active = analysis?.[key]
                return (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 11px", borderRadius: 100,
                    background: active ? "var(--risk-high)" : "rgba(255,255,255,.07)",
                    border: `1px solid ${active ? "var(--risk-high)" : "rgba(255,255,255,.12)"}`,
                    fontSize: 11, fontWeight: 600,
                    color: active ? "#fff" : "rgba(255,255,255,.4)",
                    transition: "all .3s",
                  }}>
                    {icon} {label}
                  </div>
                )
              })}
            </div>

            {/* High risk alert */}
            {riskLevel === "high" && (
              <div style={{ background: "var(--risk-high)", borderRadius: "var(--r-md)", padding: "13px 16px", display: "flex", gap: 12, alignItems: "center", animation: "fadeIn .3s ease" }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🚨</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>High scam risk detected!</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.85)", marginTop: 2 }}>End this call immediately. Do not share any OTP, PIN or personal details.</div>
                </div>
                <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>
              </div>
            )}

            {/* Live transcript — concise, one sentence at a time */}
            <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "var(--r-lg)", padding: "16px 18px", minHeight: 80, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--risk-low)", animation: "pulse 1.5s ease-in-out infinite" }} />
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,.4)" }}>Live</div>
              </div>

              {interimText ? (
                /* Words appearing in real-time */
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", alignItems: "center" }}>
                  {interimText.split(" ").filter(Boolean).map((word, i) => (
                    <span key={i} style={{
                      fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,.9)",
                      animation: "wordPop .15s ease",
                    }}>{word}</span>
                  ))}
                  <span style={{ width: 2, height: 18, background: "var(--gold-400)", borderRadius: 1, animation: "blink 1s step-end infinite", alignSelf: "center" }} />
                </div>
              ) : lastSentence ? (
                /* Confirmed sentence fades slightly */
                <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,.45)", fontStyle: "italic", lineHeight: 1.5 }}>
                  "{lastSentence}"
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.25)", fontFamily: "var(--ff-mono)" }}>
                  Waiting for speech…
                </p>
              )}

              <style>{`
                @keyframes wordPop { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
                @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
              `}</style>
            </div>

            {/* Red flags */}
            {analysis?.red_flags?.length > 0 && (
              <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "var(--r-lg)", padding: "13px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,.4)", marginBottom: 10 }}>Detected Red Flags</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {analysis.red_flags.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,.8)" }}>
                      <span style={{ color: "var(--risk-high)", flexShrink: 0, marginTop: 1 }}>⚑</span>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ height: 8 }} />
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="cta-bar" style={{ background: listening ? "var(--navy-900)" : "#fff", borderTopColor: listening ? "rgba(255,255,255,.08)" : "var(--ink-100)" }}>
        {!listening ? (
          <button className="btn btn-pri" onClick={startListening} style={{ background: "var(--risk-high)", fontSize: 15, padding: "15px" }}>
            📞 Start Monitoring Call
          </button>
        ) : (
          <>
            <button className="btn btn-danger" onClick={stopListening}>
              ⏹ Stop Monitoring
            </button>
            {analysis && (
              <button className="btn btn-sec" onClick={() => { stopListening(); navigate("/actions") }}
                style={{ background: "rgba(255,255,255,.08)", borderColor: "rgba(255,255,255,.15)", color: "#fff", fontSize: 13 }}>
                View safety actions
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
