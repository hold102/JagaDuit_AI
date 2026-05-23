import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"

// Convert http(s):// to ws(s):// so WebSocket uses the same host/port as REST calls
const WS_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")
  .replace(/^http/, "ws") + "/api/voice/scan"

const MODES = [
  { key: "live", title: "Live transcript" },
  { key: "voice_summary", title: "Voice summary" },
]

const SIGNALS = [
  { key: "impersonation_detected", label: "Impersonation" },
  { key: "emotional_pressure", label: "Urgency / Pressure" },
  { key: "suspicious_link", label: "Suspicious Link" },
  { key: "app_download_detected", label: "App Install Request" },
  { key: "otp_solicitation_detected", label: "OTP Request" },
]

function riskColor(level) {
  return level === "high" ? "#f43f5e" : level === "medium" ? "#f59e0b" : "#34d399"
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

export default function VoiceScan() {
  const navigate = useNavigate()
  const { transferData, setTransferData } = useTransfer()

  const [mode, setMode] = useState("live")
  const [listening, setListening] = useState(false)
  const [summaryListening, setSummaryListening] = useState(false)
  const [supported] = useState(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition))
  const [lastSentence, setLastSentence] = useState("")
  const [interimText, setInterimText] = useState("")
  const [summaryInterim, setSummaryInterim] = useState("")
  const [callSummary, setCallSummary] = useState(transferData.suspiciousMessage || "")
  const [analysis, setAnalysis] = useState(null)
  const [wsStatus, setWsStatus] = useState("idle")
  const [callDuration, setCallDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const wsRef = useRef(null)
  const recogRef = useRef(null)
  const summaryRecogRef = useRef(null)
  const accumulatedRef = useRef("")
  const timerRef = useRef(null)
  const sendTimerRef = useRef(null)

  function connectWS() {
    const ws = new WebSocket(WS_URL)
    ws.onopen = () => setWsStatus("connected")
    ws.onerror = () => setWsStatus("error")
    ws.onclose = () => setWsStatus("idle")
    ws.onmessage = event => {
      const data = JSON.parse(event.data)
      if (data.status === "analyzed") setAnalysis(data)
    }
    wsRef.current = ws
  }

  function sendToBackend(accumulated) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ accumulated }))
    }
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    connectWS()

    const recog = new SpeechRecognition()
    recog.continuous = true
    recog.interimResults = true
    recog.lang = "en-US"

    recog.onresult = event => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim()
        if (event.results[i].isFinal) {
          accumulatedRef.current += " " + text
          setLastSentence(text)
          setInterimText("")
          // 4-second debounce avoids flooding the backend after every word —
          // analysis only fires when the caller pauses, giving better context.
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

    recog.onerror = event => {
      if (event.error !== "no-speech") console.error("Speech error:", event.error)
    }

    // Web Speech API stops automatically on silence; restart it for continuous live monitoring
    recog.onend = () => {
      if (recogRef.current === recog) {
        try { recog.start() } catch { recogRef.current = null }
      }
    }

    recog.start()
    recogRef.current = recog
    timerRef.current = setInterval(() => setCallDuration(duration => duration + 1), 1000)

    setListening(true)
    setLastSentence("")
    setInterimText("")
    setAnalysis(null)
    accumulatedRef.current = ""
  }

  function stopListening() {
    const finalTranscript = accumulatedRef.current.trim()
    recogRef.current?.stop()
    recogRef.current = null
    if (finalTranscript.length > 30) sendToBackend(finalTranscript)
    wsRef.current?.close()
    wsRef.current = null
    clearInterval(timerRef.current)
    clearTimeout(sendTimerRef.current)
    setListening(false)
    setInterimText("")
    setCallDuration(0)
  }

  function startVoiceSummary() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recog = new SpeechRecognition()
    recog.continuous = true
    recog.interimResults = true
    recog.lang = "en-US"

    recog.onresult = event => {
      let interim = ""
      let finalText = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim()
        if (event.results[i].isFinal) {
          finalText += `${text} `
        } else {
          interim = text
        }
      }
      if (finalText) {
        setCallSummary(previous => `${previous}${previous.trim() ? " " : ""}${finalText.trim()}`)
      }
      setSummaryInterim(interim)
    }

    recog.onerror = event => {
      if (event.error !== "no-speech") setError("Speech-to-text stopped. You can continue by typing the call summary.")
    }

    recog.onend = () => {
      setSummaryListening(false)
      setSummaryInterim("")
      summaryRecogRef.current = null
    }

    setError("")
    setSummaryInterim("")
    recog.start()
    summaryRecogRef.current = recog
    setSummaryListening(true)
  }

  function stopVoiceSummary() {
    summaryRecogRef.current?.stop()
    summaryRecogRef.current = null
    setSummaryListening(false)
    setSummaryInterim("")
  }

  function changeMode(nextMode) {
    if (listening) stopListening()
    if (summaryListening) stopVoiceSummary()
    setMode(nextMode)
    setError("")
  }

  // Voice summary mode routes through /analyzing so the loading screen fires the API call —
  // avoids duplicating the analyzeCall logic here.
  function analyzeSummary() {
    if (!callSummary.trim() || loading) return
    navigate("/analyzing", { state: { voiceCall: { transcript: callSummary } } })
  }

  const riskLevel = String(analysis?.risk_level || "").toLowerCase()
  const riskScore = analysis?.risk_score ?? 0
  const color = riskLevel ? riskColor(riskLevel) : "rgba(255,255,255,0.3)"
  const canAnalyzeSummary = callSummary.trim().length > 0 && !loading

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "#fff", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes wordPop { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button
          onClick={() => { if (listening) stopListening(); if (summaryListening) stopVoiceSummary(); navigate(-1) }}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}
        >‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Voice Scanner</div>
          {listening && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", marginTop: 2 }}>
              {formatTime(callDuration)}
            </div>
          )}
        </div>
        {listening && wsStatus === "connected" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", animation: "pulse 1.5s ease-in-out infinite" }} />
            LIVE
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 120px" }}>
        {/* Mode tabs */}
        {!listening && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {MODES.map(option => {
              const active = mode === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => changeMode(option.key)}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: active ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.05)",
                    border: active ? "1px solid rgba(167,139,250,0.5)" : "0.5px solid rgba(255,255,255,0.1)",
                    color: active ? "#c4b5fd" : "rgba(255,255,255,0.45)",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {option.title}
                </button>
              )
            })}
          </div>
        )}

        {/* Live mode idle */}
        {!listening && mode === "live" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center", paddingTop: 32 }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: "rgba(244,63,94,0.12)", border: "0.5px solid rgba(244,63,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>📞</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Live call monitoring</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, maxWidth: 280 }}>
              Tap Start, then put your phone on speaker during a suspicious call. AI analyses in real time.
            </div>
            {!supported && (
              <div style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 14, color: "#fca5a5", fontSize: 12, padding: "10px 14px", width: "100%" }}>
                Speech-to-text not supported. Use Chrome or Edge.
              </div>
            )}
          </div>
        )}

        {/* Listening state */}
        {listening && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Risk score card */}
            <div style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)" }}>Risk Score</div>
                {riskLevel && (
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 9px", borderRadius: 100, background: color + "22", color }}>
                    {riskLevel === "low" ? "Low Risk" : riskLevel === "medium" ? "Medium Risk" : "High Risk"}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <div style={{ fontFamily: "monospace", fontSize: 44, fontWeight: 600, color, transition: "color .4s", lineHeight: 1 }}>{riskScore}</div>
                <div style={{ fontFamily: "monospace", fontSize: 16, color: "rgba(255,255,255,0.3)" }}>/ 100</div>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 100, marginTop: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${riskScore}%`, background: color, borderRadius: 100, transition: "width .6s, background .4s" }} />
              </div>
              {analysis?.scam_type && (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                  Detected: <span style={{ color }}>{analysis.scam_type}</span>
                </div>
              )}
              {!analysis && (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>Listening for patterns...</div>
              )}
            </div>

            {/* Signal chips */}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {SIGNALS.map(({ key, label }) => {
                const active = analysis?.[key]
                return (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 11px", borderRadius: 100,
                    background: active ? "#f43f5e" : "rgba(255,255,255,0.07)",
                    border: `1px solid ${active ? "#f43f5e" : "rgba(255,255,255,0.12)"}`,
                    fontSize: 11, fontWeight: 600,
                    color: active ? "#fff" : "rgba(255,255,255,0.4)",
                    transition: "all .3s",
                  }}>
                    {label}
                  </div>
                )
              })}
            </div>

            {/* OTP warning */}
            {analysis?.otp_solicitation_detected && (
              <div style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6, animation: "fadeIn .3s ease" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fca5a5", letterSpacing: ".02em" }}>
                  ⚠ DO NOT SHARE YOUR OTP / TAC
                </div>
                <div style={{ fontSize: 11, color: "#fca5a5", lineHeight: 1.45, opacity: 0.9 }}>
                  {analysis.otp_alert?.message ||
                   "Someone is asking you to share a one-time passcode. Real banks and agencies will NEVER ask for this."}
                </div>
                {analysis.otp_alert?.matched_text && (
                  <div style={{ fontSize: 10, color: "rgba(252,165,165,0.7)", fontFamily: "monospace", marginTop: 2 }}>
                    Heard: "{analysis.otp_alert.matched_text}"
                  </div>
                )}
              </div>
            )}

            {/* App download warning */}
            {analysis?.app_download_detected && (
              <div style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6, animation: "fadeIn .3s ease" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fca5a5", letterSpacing: ".02em" }}>
                  ⚠ DO NOT INSTALL ANY APP
                </div>
                <div style={{ fontSize: 11, color: "#fca5a5", lineHeight: 1.45, opacity: 0.9 }}>
                  {analysis.app_download_alert?.message ||
                   "Caller is asking you to install a remote-access app. No real bank or agency will ever ask this — end the call now."}
                </div>
                {analysis.app_download_alert?.app_name && (
                  <div style={{ fontSize: 10, color: "rgba(252,165,165,0.7)", fontFamily: "monospace", marginTop: 2 }}>
                    Detected: "{analysis.app_download_alert.app_name}"
                  </div>
                )}
              </div>
            )}

            {/* General high risk */}
            {riskLevel === "high" && !analysis?.app_download_detected && !analysis?.otp_solicitation_detected && (
              <div style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 14, padding: "13px 16px", display: "flex", gap: 12, alignItems: "center", animation: "fadeIn .3s ease" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>High scam risk detected</div>
                  <div style={{ fontSize: 11, color: "rgba(252,165,165,0.8)", marginTop: 2 }}>End this call immediately. Do not share any OTP, PIN or personal details.</div>
                </div>
              </div>
            )}

            {/* Live transcript box */}
            <div style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "16px 18px", minHeight: 80, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", animation: "pulse 1.5s ease-in-out infinite" }} />
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,0.4)" }}>Live transcript</div>
              </div>

              {interimText ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", alignItems: "center" }}>
                  {interimText.split(" ").filter(Boolean).map((word, i) => (
                    <span key={i} style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.9)", animation: "wordPop .15s ease" }}>{word}</span>
                  ))}
                  <span style={{ width: 2, height: 18, background: "#f59e0b", borderRadius: 1, animation: "blink 1s step-end infinite", alignSelf: "center" }} />
                </div>
              ) : lastSentence ? (
                <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.45)", fontStyle: "italic", lineHeight: 1.5 }}>"{lastSentence}"</p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>Waiting for speech...</p>
              )}
            </div>

            {/* Red flags */}
            {analysis?.red_flags?.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "13px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Detected Red Flags</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {analysis.red_flags.map((flag, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                      <span style={{ color: "#f43f5e", flexShrink: 0, marginTop: 1 }}>!</span>
                      {flag}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Voice summary mode */}
        {!listening && mode === "voice_summary" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {supported && (
              <div style={{ display: "flex", gap: 8 }}>
                {!summaryListening ? (
                  <button
                    type="button"
                    onClick={startVoiceSummary}
                    style={{ flex: 1, padding: "13px 16px", borderRadius: 14, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "#c4b5fd", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                  >
                    🎙 Record
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopVoiceSummary}
                    style={{ flex: 1, padding: "13px 16px", borderRadius: 14, background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", color: "#fca5a5", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                  >
                    Stop
                  </button>
                )}
              </div>
            )}
            {summaryInterim && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>{summaryInterim}</div>
            )}

            <textarea
              value={callSummary}
              onChange={event => setCallSummary(event.target.value)}
              placeholder="Type or speak the call summary…"
              rows={7}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                color: "#fff",
                padding: "14px 16px",
                fontSize: 14,
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit",
                lineHeight: 1.55,
              }}
            />

            {error && (
              <div style={{ padding: "10px 14px", background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 14, fontSize: 13, color: "#fca5a5" }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTA Bar */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(100vw, 430px)", padding: "16px 20px 34px", background: "rgba(10,10,16,0.9)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
        {mode === "live" ? (
          !listening ? (
            <button
              onClick={startListening}
              disabled={!supported}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: supported ? "linear-gradient(135deg, #f43f5e, #dc2626)" : "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: supported ? "pointer" : "not-allowed" }}
            >
              Start
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={stopListening}
                style={{ flex: 1, padding: 16, borderRadius: 16, background: "rgba(244,63,94,0.2)", border: "1px solid rgba(244,63,94,0.5)", color: "#fca5a5", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
              >
                Stop
              </button>
              {analysis && (
                <button
                  onClick={() => { stopListening(); navigate("/actions") }}
                  style={{ flex: 1, padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  Safety actions
                </button>
              )}
            </div>
          )
        ) : (
          <button
            type="button"
            disabled={!canAnalyzeSummary}
            onClick={analyzeSummary}
            style={{ width: "100%", padding: 16, borderRadius: 16, background: canAnalyzeSummary ? "linear-gradient(135deg, #a78bfa, #ec4899)" : "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: canAnalyzeSummary ? "pointer" : "not-allowed", opacity: canAnalyzeSummary ? 1 : 0.5 }}
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        )}
      </div>
    </div>
  )
}
