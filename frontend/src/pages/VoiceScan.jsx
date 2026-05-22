import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { analyzeCall } from "../utils/api"

const WS_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8001")
  .replace(/^http/, "ws") + "/api/voice/scan"

const MODES = [
  {
    key: "live",
    title: "Live transcript",
    subtitle: "Analyze the call in real time while the conversation is happening.",
  },
  {
    key: "voice_summary",
    title: "Voice summary",
    subtitle: "After the call, speak a short summary of what the caller said.",
  },
]

const SIGNALS = [
  { key: "impersonation_detected", label: "Impersonation" },
  { key: "emotional_pressure", label: "Urgency / Pressure" },
  { key: "suspicious_link", label: "Suspicious Link" },
]

function riskColor(level) {
  return level === "high" ? "var(--risk-high)" : level === "medium" ? "var(--risk-med)" : "var(--risk-low)"
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

  async function analyzeSummary() {
    if (!callSummary.trim() || loading) return

    setLoading(true)
    setError("")
    try {
      const result = await analyzeCall({
        evidenceSource: "phone_call",
        inputMode: "voice_summary",
        transcript: callSummary,
        amount: transferData.amount || "",
        recipientName: transferData.recipient || "",
        recipientAccount: transferData.accountNo || "",
        paymentContext: "transfer_before_payment",
      })

      setTransferData(prev => ({
        ...prev,
        suspiciousMessage: callSummary,
        evidenceSource: "phone_call",
        paymentContext: {
          ...prev.paymentContext,
          requestSource: "phone_call",
          evidenceSource: "phone_call",
        },
        analysisResult: result,
      }))

      navigate("/result")
    } catch (err) {
      console.error("Call risk analysis failed", {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.url,
        baseURL: err?.config?.baseURL,
        method: err?.config?.method,
      })
      setError("Call risk analysis failed. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  const riskLevel = analysis?.risk_level
  const riskScore = analysis?.risk_score ?? 0
  const color = riskLevel ? riskColor(riskLevel) : "var(--ink-300)"
  const canAnalyzeSummary = callSummary.trim().length > 0 && !loading

  return (
    <div className="scr" style={{ background: listening ? "#0a1f3d" : "#fff", transition: "background .4s" }}>
      <div className="scr-header" style={{ background: listening ? "var(--navy-900)" : "#fff", borderBottomColor: listening ? "rgba(255,255,255,.08)" : "var(--ink-100)", transition: "background .4s" }}>
        <button
          className="back-btn"
          onClick={() => { if (listening) stopListening(); if (summaryListening) stopVoiceSummary(); navigate(-1) }}
          style={{ color: listening ? "rgba(255,255,255,.8)" : "var(--ink-700)" }}
        >
          {"<"}
        </button>
        <div style={{ flex: 1 }}>
          <div className="hdr-title" style={{ color: listening ? "#fff" : "var(--ink-900)" }}>Voice Call Scanner</div>
          <div className="hdr-sub" style={{ color: listening ? "rgba(255,255,255,.5)" : "var(--ink-500)" }}>
            {listening ? `Monitoring - ${formatTime(callDuration)}` : "User-consented speech-to-text"}
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
        {!listening && (
          <div style={{ padding: "16px 18px 0" }}>
            <div style={{ fontSize: 19, fontWeight: 600, color: "var(--ink-900)", letterSpacing: "-.015em" }}>How do you want to check the call?</div>
            <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6, lineHeight: 1.5 }}>
              Use live transcript during a call, or add a call summary after it ends.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              {MODES.map(option => {
                const active = mode === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => changeMode(option.key)}
                    className="dcard"
                    style={{
                      all: "unset",
                      boxSizing: "border-box",
                      padding: "14px",
                      borderColor: active ? "var(--navy-700)" : "var(--line)",
                      background: active ? "var(--navy-25)" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)" }}>{option.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4, lineHeight: 1.45 }}>{option.subtitle}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!listening && mode === "live" && (
          <div style={{ padding: "22px 24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--navy-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "var(--navy-700)" }}>CALL</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-900)", letterSpacing: "-.015em" }}>Received a suspicious call?</div>
              <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6, lineHeight: 1.5 }}>
                Put the caller on speaker, then tap Start. AI listens in real time and flags scam patterns as they speak.
              </div>
            </div>

            <div style={{ width: "100%", textAlign: "left", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { n: "1", t: "Put caller on speaker", d: "So your phone mic can pick up both sides" },
                { n: "2", t: "Tap Start Monitoring", d: "AI begins listening and transcribing live" },
                { n: "3", t: "Watch for alerts", d: "Risk signals appear as the call progresses" },
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

            {!supported && (
              <div style={{ fontSize: 12, color: "var(--risk-high)", padding: "10px 13px", background: "var(--risk-high-bg)", borderRadius: "var(--r-md)", lineHeight: 1.45, width: "100%" }}>
                Speech-to-text is not supported in this browser. Please type the call summary instead.
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--ink-400)", padding: "10px 16px", background: "var(--ink-50)", borderRadius: "var(--r-md)", lineHeight: 1.5, width: "100%" }}>
              Works best on Chrome or Edge. Speech is processed through browser speech-to-text; audio is not sent to a JagaDuit recording service.
            </div>
          </div>
        )}

        {listening && (
          <div style={{ padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "var(--r-lg)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,.5)" }}>Risk Score</div>
                {riskLevel && (
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", padding: "3px 9px", borderRadius: 100, background: color + "22", color }}>
                    {riskLevel === "low" ? "Low Risk" : riskLevel === "medium" ? "Medium Risk" : "High Risk"}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <div style={{ fontFamily: "var(--ff-mono)", fontSize: 44, fontWeight: 600, color, transition: "color .4s", lineHeight: 1 }}>{riskScore}</div>
                <div style={{ fontFamily: "var(--ff-mono)", fontSize: 16, color: "rgba(255,255,255,.3)" }}>/ 100</div>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,.1)", borderRadius: 100, marginTop: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${riskScore}%`, background: color, borderRadius: 100, transition: "width .6s, background .4s" }} />
              </div>
              {analysis?.scam_type && (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 500 }}>
                  Detected: <span style={{ color }}>{analysis.scam_type}</span>
                </div>
              )}
              {!analysis && (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.4)", fontFamily: "var(--ff-mono)" }}>Listening for patterns...</div>
              )}
            </div>

            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {SIGNALS.map(({ key, label }) => {
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
                    {label}
                  </div>
                )
              })}
            </div>

            {riskLevel === "high" && (
              <div style={{ background: "var(--risk-high)", borderRadius: "var(--r-md)", padding: "13px 16px", display: "flex", gap: 12, alignItems: "center", animation: "fadeIn .3s ease" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>High scam risk detected</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.85)", marginTop: 2 }}>End this call immediately. Do not share any OTP, PIN or personal details.</div>
                </div>
                <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>
              </div>
            )}

            <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "var(--r-lg)", padding: "16px 18px", minHeight: 80, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--risk-low)", animation: "pulse 1.5s ease-in-out infinite" }} />
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,.4)" }}>Live transcript</div>
              </div>

              {interimText ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", alignItems: "center" }}>
                  {interimText.split(" ").filter(Boolean).map((word, i) => (
                    <span key={i} style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,.9)", animation: "wordPop .15s ease" }}>{word}</span>
                  ))}
                  <span style={{ width: 2, height: 18, background: "var(--gold-400)", borderRadius: 1, animation: "blink 1s step-end infinite", alignSelf: "center" }} />
                </div>
              ) : lastSentence ? (
                <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,.45)", fontStyle: "italic", lineHeight: 1.5 }}>"{lastSentence}"</p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.25)", fontFamily: "var(--ff-mono)" }}>Waiting for speech...</p>
              )}

              <style>{`
                @keyframes wordPop { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
                @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
              `}</style>
            </div>

            {analysis?.red_flags?.length > 0 && (
              <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "var(--r-lg)", padding: "13px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,.4)", marginBottom: 10 }}>Detected Red Flags</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {analysis.red_flags.map((flag, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,.8)" }}>
                      <span style={{ color: "var(--risk-high)", flexShrink: 0, marginTop: 1 }}>!</span>
                      {flag}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ height: 8 }} />
          </div>
        )}

        {!listening && mode === "voice_summary" && (
          <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="dcard" style={{ padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-900)" }}>Speak what the caller said</div>
              <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 5, lineHeight: 1.45 }}>
                Use user-consented speech-to-text to create an editable call summary after the call.
              </div>
              {!supported && (
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--risk-high)", lineHeight: 1.45 }}>
                  Speech-to-text is not supported in this browser. You can type the call summary manually below.
                </div>
              )}
              {supported && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {!summaryListening ? (
                    <button type="button" className="btn btn-pri" onClick={startVoiceSummary} style={{ flex: 1 }}>Start voice summary</button>
                  ) : (
                    <button type="button" className="btn btn-danger" onClick={stopVoiceSummary} style={{ flex: 1 }}>Stop recording</button>
                  )}
                </div>
              )}
              {summaryListening && (
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--navy-700)", fontWeight: 600 }}>Listening...</div>
              )}
              {summaryInterim && (
                <div style={{ marginTop: 7, fontSize: 12, color: "var(--ink-500)", fontStyle: "italic" }}>{summaryInterim}</div>
              )}
            </div>

            <div>
              <div className="field-lbl" style={{ marginBottom: 7 }}>Call Summary</div>
              <textarea
                className="paste-area"
                value={callSummary}
                onChange={event => setCallSummary(event.target.value)}
                placeholder="After using voice summary, you can edit the transcript here if needed."
              />
            </div>

            {error && (
              <div style={{ padding: "10px 13px", background: "var(--risk-high-bg)", border: "1px solid rgba(196,28,51,.2)", borderRadius: "var(--r-md)", fontSize: 13, color: "var(--risk-high)" }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cta-bar" style={{ background: listening ? "var(--navy-900)" : "#fff", borderTopColor: listening ? "rgba(255,255,255,.08)" : "var(--ink-100)" }}>
        {mode === "live" ? (
          !listening ? (
            <button className="btn btn-pri" onClick={startListening} disabled={!supported} style={{ background: "var(--risk-high)", fontSize: 15, padding: "15px" }}>
              Start Monitoring Call
            </button>
          ) : (
            <>
              <button className="btn btn-danger" onClick={stopListening}>Stop Monitoring</button>
              {analysis && (
                <button className="btn btn-sec" onClick={() => { stopListening(); navigate("/actions") }} style={{ background: "rgba(255,255,255,.08)", borderColor: "rgba(255,255,255,.15)", color: "#fff", fontSize: 13 }}>
                  View safety actions
                </button>
              )}
            </>
          )
        ) : (
          <button className="btn btn-pri" type="button" disabled={!canAnalyzeSummary} onClick={analyzeSummary}>
            {loading ? "Analyzing call risk..." : "Analyze call risk"}
          </button>
        )}
      </div>
    </div>
  )
}
