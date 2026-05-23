import { useEffect, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { analyzeTransfer, telegramAnalyze, analyzeCall } from "../utils/api"

export default function Analyzing() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setTransferData, transferData } = useTransfer()

  // state carries the scan context passed by the previous page — presence of telegram/voiceCall
  // determines which API endpoint to call.
  const state = useMemo(() => location.state || {}, [location.state])
  const isTelegram = !!state.telegram
  const isVoiceCall = !!state.voiceCall

  useEffect(() => {
    if (isVoiceCall) {
      const { transcript } = state.voiceCall
      analyzeCall({
        evidenceSource: "phone_call",
        inputMode: "voice_summary",
        transcript,
        amount: transferData.amount || "",
        recipientName: transferData.recipient || "",
        recipientAccount: transferData.accountNo || "",
        paymentContext: "transfer_before_payment",
      })
        .then(result => {
          setTransferData(prev => ({
            ...prev,
            suspiciousMessage: transcript,
            evidenceSource: "phone_call",
            paymentContext: { ...prev.paymentContext, requestSource: "phone_call", evidenceSource: "phone_call" },
            analysisResult: result,
          }))
          navigate(result.risk_level === "low" ? "/safe" : "/cooling-off")
        })
        .catch(() => navigate("/voice"))
    } else if (isTelegram) {
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
      // Generic path for /analyze — message was passed directly from an older scan flow
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
          navigate(result.risk_level === "low" ? "/safe" : "/cooling-off")
        })
        .catch(() => navigate("/check"))
    }
  }, [isTelegram, isVoiceCall, navigate, setTransferData, state, transferData.accountNo, transferData.amount, transferData.evidenceSource, transferData.purpose, transferData.recipient])

  return (
    <div style={{ minHeight: "100vh", background: "#05060a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24, fontFamily: "-apple-system, system-ui, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ position: "relative", width: 84, height: 84 }}>
        <svg viewBox="0 0 84 84" width="84" height="84">
          <defs>
            <linearGradient id="ringG" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle cx="42" cy="42" r="34" fill="none" stroke="url(#ringG)" strokeWidth="3"
            strokeLinecap="round" strokeDasharray="55 220" transform="rotate(-90 42 42)">
            <animateTransform attributeName="transform" type="rotate" from="-90 42 42" to="270 42 42" dur="1.1s" repeatCount="indefinite" />
          </circle>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
          {isVoiceCall ? "📞" : isTelegram ? "✈️" : "🛡️"}
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: "0.01em" }}>
        Analyzing…
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.02em" }}>
        Checking for scam signals
      </div>
    </div>
  )
}
