import { useEffect, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { analyzeTransfer, telegramAnalyze, analyzeCall } from "../utils/api"

export default function Analyzing() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setTransferData, transferData } = useTransfer()

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
          navigate(String(result.risk_level).toLowerCase() === "low" ? "/safe" : "/cooling-off")
        })
        .catch(() => navigate("/voice"))
    } else if (isTelegram) {
      const { chatId, chatName, chatKind } = state.telegram
      telegramAnalyze(chatId, 30)
        .then(result => {
          const analysis = result.analysis || result
          const messageCount = result.messages?.length || analysis.message_count || 0
          setTransferData(prev => ({
            ...prev,
            suspiciousMessage: result.combinedText || `[Telegram scan - ${chatName} - ${messageCount} messages]`,
            evidenceSource: "telegram",
            paymentContext: {
              ...prev.paymentContext,
              requestSource: "telegram",
              evidenceSource: "telegram",
              recipientType: chatKind === "user" ? "individual" : "unknown",
            },
            analysisResult: analysis,
          }))
          navigate("/telegram-result")
        })
        .catch(() => navigate("/telegram"))
    } else {
      const { message, source, evidenceSource, ctx } = state
      if (!message) {
        navigate("/check")
        return
      }
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
          navigate(String(result.risk_level).toLowerCase() === "low" ? "/safe" : "/cooling-off")
        })
        .catch(() => navigate("/check"))
    }
  }, [isTelegram, isVoiceCall, navigate, setTransferData, state, transferData.accountNo, transferData.amount, transferData.evidenceSource, transferData.purpose, transferData.recipient])

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24, fontFamily: "-apple-system, system-ui, sans-serif" }}>
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
          {isVoiceCall ? "Phone" : isTelegram ? "TG" : "AI"}
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: "0.01em" }}>
        Analyzing...
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.02em" }}>
        Checking for scam signals
      </div>
    </div>
  )
}
