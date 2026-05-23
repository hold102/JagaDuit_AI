import { useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import Tesseract from "tesseract.js"
import { useTransfer } from "../context/TransferContext"
import { analyzeChat } from "../utils/api"

const GENERIC_SOURCES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "messenger_facebook", label: "Messenger / Facebook" },
  { value: "instagram_dm", label: "Instagram DM" },
  { value: "other", label: "Other" },
]

const GENERIC_SOURCE_VALUES = GENERIC_SOURCES.map(source => source.value)
const SUPPORTED_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"]
const OCR_IDLE_MESSAGE = ""
const OCR_EXTRACTING_MESSAGE = "Reading…"
const OCR_SUCCESS_MESSAGE = "Text extracted. Review below."
const OCR_FAILURE_MESSAGE = "Couldn't read text — paste manually."
// Tesseract assets are served from /public/tesseract/ to avoid the CDN dependency at runtime —
// important because users may run the app on mobile networks with restricted CDN access.
const OCR_OPTIONS = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract",
  langPath: "/tesseract",
  gzip: false,
}

export default function ChatScan() {
  const navigate = useNavigate()
  const location = useLocation()
  const { transferData, setTransferData, setEvidenceSource } = useTransfer()
  const initialSource = GENERIC_SOURCE_VALUES.includes(location.state?.evidenceSource)
    ? location.state.evidenceSource
    : GENERIC_SOURCE_VALUES.includes(transferData.evidenceSource)
      ? transferData.evidenceSource
      : "other"

  const [evidenceSource, setLocalEvidenceSource] = useState(initialSource)
  const [messageText, setMessageText] = useState(transferData.suspiciousMessage || "")
  const [screenshotName, setScreenshotName] = useState("")
  const [ocrMessage, setOcrMessage] = useState(OCR_IDLE_MESSAGE)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const charCount = useMemo(() => messageText.length, [messageText])
  const canAnalyze = messageText.trim().length > 0 && !loading && !ocrLoading

  async function handleScreenshotUpload(event) {
    const file = event.target.files?.[0]
    setScreenshotName(file?.name || "")
    setError("")

    if (!file) {
      setOcrMessage(OCR_IDLE_MESSAGE)
      return
    }

    if (!SUPPORTED_SCREENSHOT_TYPES.includes(file.type)) {
      setOcrMessage(OCR_FAILURE_MESSAGE)
      event.target.value = ""
      return
    }

    setOcrLoading(true)
    setOcrMessage(OCR_EXTRACTING_MESSAGE)

    try {
      const result = await Tesseract.recognize(file, "eng", OCR_OPTIONS)
      const extractedText = result.data.text.trim()

      if (!extractedText) {
        setOcrMessage(OCR_FAILURE_MESSAGE)
        return
      }

      setMessageText(extractedText)
      setOcrMessage(OCR_SUCCESS_MESSAGE)
    } catch (err) {
      console.error("Screenshot OCR failed", err)
      setOcrMessage(OCR_FAILURE_MESSAGE)
    } finally {
      setOcrLoading(false)
      event.target.value = ""
    }
  }

  function selectEvidenceSource(source) {
    setLocalEvidenceSource(source)
    setEvidenceSource(source)
  }

  async function handleAnalyze(event) {
    event.preventDefault()
    if (!canAnalyze) return

    setError("")
    setLoading(true)
    try {
      const result = await analyzeChat({
        evidenceSource,
        messageText,
        amount: transferData.amount || "",
        recipientName: transferData.recipient || "",
        recipientAccount: transferData.accountNo || "",
        paymentContext: "transfer_before_payment",
      })

      setTransferData(prev => ({
        ...prev,
        suspiciousMessage: messageText,
        evidenceSource,
        paymentContext: {
          ...prev.paymentContext,
          requestSource: evidenceSource,
          evidenceSource,
        },
        analysisResult: result,
      }))

      // Both medium and high risk land on /cooling-off — the 10-second pause applies to all non-safe results
      navigate(String(result.risk_level).toLowerCase() === "low" ? "/safe" : "/cooling-off")
    } catch {
      setError("Evidence scan failed. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleAnalyze}
      style={{ minHeight: "100vh", background: "transparent", color: "#fff", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "54px 20px 16px" }}>
        <button type="button" onClick={() => navigate("/check")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Scan Evidence</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 120px" }}>
        {/* Upload screenshot */}
        <label style={{ display: "block", cursor: ocrLoading ? "wait" : "pointer", opacity: ocrLoading ? 0.82 : 1, marginBottom: 16 }}>
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            onChange={handleScreenshotUpload}
            disabled={ocrLoading || loading}
            style={{ display: "none" }}
          />
          <div style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(167,139,250,0.15)", border: "0.5px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📷</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                {ocrLoading ? OCR_EXTRACTING_MESSAGE : screenshotName || "Upload screenshot"}
              </div>
              {ocrMessage && !ocrLoading && (
                <div style={{ fontSize: 11, color: ocrMessage === OCR_SUCCESS_MESSAGE ? "#34d399" : "rgba(255,255,255,0.45)", marginTop: 2 }}>{ocrMessage}</div>
              )}
            </div>
          </div>
        </label>

        {/* Source selector chips */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Source</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GENERIC_SOURCES.map(source => {
              const selected = evidenceSource === source.value
              return (
                <button
                  key={source.value}
                  type="button"
                  onClick={() => selectEvidenceSource(source.value)}
                  style={{
                    border: selected ? "1px solid rgba(167,139,250,0.7)" : "1px solid rgba(255,255,255,0.12)",
                    background: selected ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.05)",
                    color: selected ? "#c4b5fd" : "rgba(255,255,255,0.55)",
                    borderRadius: 999,
                    padding: "7px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {source.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Textarea */}
        <div style={{ marginBottom: 8 }}>
          <textarea
            value={messageText}
            onChange={event => setMessageText(event.target.value)}
            disabled={loading}
            placeholder="Paste suspicious message…"
            rows={6}
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
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", textAlign: "right", marginTop: 4 }}>
            {charCount}
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 14, fontSize: 13, color: "#fca5a5", marginTop: 8 }}>
            {error}
          </div>
        )}
      </div>

      {/* CTA Bar */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "min(100vw, 430px)", padding: "16px 20px 34px", background: "rgba(10,10,16,0.85)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
        <button
          type="submit"
          disabled={!canAnalyze}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: canAnalyze ? "linear-gradient(135deg, #a78bfa, #ec4899)" : "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: canAnalyze ? "pointer" : "not-allowed", opacity: canAnalyze ? 1 : 0.5 }}
        >
          {ocrLoading ? "Reading…" : loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>
    </form>
  )
}
