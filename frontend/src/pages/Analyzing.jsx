import { useState, useEffect, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { analyzeTransfer, telegramAnalyze } from "../utils/api"

const STEPS_MANUAL = [
  "Reading message intent…",
  "Detecting impersonation patterns…",
  "Extracting red-flag signals…",
  "Calculating risk score…",
]

const STEPS_TELEGRAM = [
  "Fetching conversation history…",
  "Reading message intent…",
  "Detecting impersonation patterns…",
  "Calculating risk score…",
]

export default function Analyzing() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setTransferData, transferData } = useTransfer()
  const [stepIdx, setStepIdx] = useState(0)

  const state = useMemo(() => location.state || {}, [location.state])
  const isTelegram = !!state.telegram
  const steps = isTelegram ? STEPS_TELEGRAM : STEPS_MANUAL

  useEffect(() => {
    const id = setInterval(() => setStepIdx(i => Math.min(i + 1, steps.length - 1)), 700)
    return () => clearInterval(id)
  }, [steps.length])

  useEffect(() => {
    if (isTelegram) {
      const { phone, chatId, chatName, chatKind } = state.telegram
      telegramAnalyze(phone, chatId, chatName)
        .then(result => {
          setTransferData(prev => ({
            ...prev,
            suspiciousMessage: `[Telegram scan — ${chatName} — ${result.message_count} messages]`,
            paymentContext: { ...prev.paymentContext, requestSource: "telegram", recipientType: chatKind === "user" ? "individual" : "unknown" },
            analysisResult: result,
          }))
          navigate("/telegram-result")
        })
        .catch(() => navigate("/telegram"))
    } else {
      const { message, source, evidenceSource, ctx } = state
      if (!message) { navigate("/check"); return }
      const selectedSource = evidenceSource || source || transferData.evidenceSource || "other"

      const payment_context = {
        recipient: transferData.recipient || "",
        amount: transferData.amount || "",
        recipientType: ctx?.knowRecipient === "yes" ? "individual" : "unknown",
        paymentPurpose: transferData.purpose || "other",
        requestSource: selectedSource,
        evidenceSource: selectedSource,
        urgency: ctx?.urgency || "medium",
      }

      analyzeTransfer({ message, payment_context })
        .then(result => {
          setTransferData(prev => ({
            ...prev,
            suspiciousMessage: message,
            evidenceSource: selectedSource,
            paymentContext: payment_context,
            analysisResult: result,
          }))
          navigate(result.risk_level === "high" ? "/cooling-off" : "/result")
        })
        .catch(() => navigate("/check"))
    }
  }, [isTelegram, navigate, setTransferData, state, transferData.amount, transferData.evidenceSource, transferData.purpose, transferData.recipient])

  return (
    <div className="scr">
      <div className="analyze-screen">
        {/* Animated ring */}
        <div className="analyze-ring">
          <svg viewBox="0 0 84 84">
            <defs>
              <linearGradient id="ringG" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f5c518" />
                <stop offset="100%" stopColor="#2563b3" />
              </linearGradient>
            </defs>
            <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3" />
            <circle cx="42" cy="42" r="34" fill="none" stroke="url(#ringG)" strokeWidth="3"
              strokeLinecap="round" strokeDasharray="55 220" transform="rotate(-90 42 42)">
              <animateTransform attributeName="transform" type="rotate" from="-90 42 42" to="270 42 42" dur="1.1s" repeatCount="indefinite" />
            </circle>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            {isTelegram ? "✈️" : "🛡️"}
          </div>
        </div>

        <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600 }}>JagaDuit AI</div>
        <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4, letterSpacing: "-.01em" }}>
          {isTelegram ? `Scanning ${state.telegram?.chatName}` : "Analyzing message"}
        </div>

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 7, width: "100%", maxWidth: 270 }}>
          {steps.map((s, i) => (
            <div key={s} className="analyze-step" style={{ opacity: i <= stepIdx ? 1 : 0.35 }}>
              <div style={{
                width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                background: i < stepIdx ? "var(--gold-500)" : "transparent",
                border: i < stepIdx ? "0" : "1.5px solid rgba(255,255,255,.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, color: "#0a1f3d", fontWeight: 700,
              }}>
                {i < stepIdx && "✓"}
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.85)", fontFamily: "var(--ff-mono)" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
