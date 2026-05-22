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
const OCR_IDLE_MESSAGE = "Upload a screenshot from WhatsApp, SMS, Email, Messenger, Instagram, or another app."
const OCR_EXTRACTING_MESSAGE = "Extracting text from screenshot..."
const OCR_SUCCESS_MESSAGE = "Text extracted from screenshot. Please review before analysis."
const OCR_FAILURE_MESSAGE = "Could not extract clear text from this screenshot. Please paste or summarize the visible message manually."
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

      navigate(result.risk_level === "high" ? "/cooling-off" : "/result")
    } catch {
      setError("Evidence scan failed. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="scr" onSubmit={handleAnalyze}>
      <div className="scr-header scr-header-dark">
        <button type="button" className="back-btn back-btn-dark" onClick={() => navigate("/check")}>{"<"}</button>
        <div style={{ flex: 1 }}>
          <div className="hdr-title hdr-title-white">Add scam evidence</div>
          <div className="hdr-sub hdr-sub-white">Chat Scan</div>
        </div>
      </div>

      <div className="scr-body">
        <div style={{ padding: "16px 18px 0" }}>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.015em", lineHeight: 1.25 }}>
            Add scam evidence before transfer
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6, lineHeight: 1.45 }}>
            Upload a screenshot or paste the suspicious message. JagaDuit AI will compare it with your transfer details before you send money.
          </div>
        </div>

        <div style={{ padding: "16px 18px 0" }}>
          <div className="field-lbl" style={{ marginBottom: 7 }}>Upload screenshot</div>
          <div style={{ fontSize: 12, color: "var(--ink-500)", marginBottom: 8, lineHeight: 1.4 }}>
            {OCR_IDLE_MESSAGE}
          </div>
          <label className="dcard" style={{ padding: 14, display: "block", cursor: ocrLoading ? "wait" : "pointer", opacity: ocrLoading ? 0.82 : 1 }}>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              onChange={handleScreenshotUpload}
              disabled={ocrLoading || loading}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--navy-50)", color: "var(--navy-700)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>IMG</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>
                  {ocrLoading ? "Reading screenshot..." : screenshotName || "Choose screenshot"}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2, lineHeight: 1.4 }}>
                  {ocrMessage}
                </div>
              </div>
            </div>
          </label>
        </div>

        <div style={{ padding: "16px 18px 0" }}>
          <div className="field-lbl" style={{ marginBottom: 7 }}>Where is this evidence from?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GENERIC_SOURCES.map(source => {
              const selected = evidenceSource === source.value
              return (
                <button
                  key={source.value}
                  type="button"
                  onClick={() => selectEvidenceSource(source.value)}
                  style={{
                    border: selected ? "1px solid var(--navy-700)" : "1px solid var(--line)",
                    background: selected ? "var(--navy-50)" : "#fff",
                    color: selected ? "var(--navy-800)" : "var(--ink-700)",
                    borderRadius: 999,
                    padding: "7px 10px",
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
          <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 7, lineHeight: 1.4 }}>
            This helps JagaDuit tune the risk checks. It does not start a direct scan of that app.
          </div>
        </div>

        <div style={{ padding: "16px 18px 0" }}>
          <div className="field-lbl" style={{ marginBottom: 7, display: "flex", justifyContent: "space-between" }}>
            <span>Paste message</span>
            <span style={{ color: "var(--ink-400)", fontFamily: "var(--ff-mono)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>{charCount} chars</span>
          </div>
          <textarea
            className="paste-area"
            value={messageText}
            onChange={event => setMessageText(event.target.value)}
            disabled={loading}
            placeholder="Paste the suspicious message, email, or conversation here..."
          />
        </div>

        <div style={{ padding: "16px 18px 0" }}>
          <div className="dcard" style={{ padding: 14, background: "var(--navy-25)", borderColor: "var(--navy-50)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>Paste shared conversation</div>
            <div style={{ fontSize: 12, color: "var(--ink-600)", marginTop: 5, lineHeight: 1.45 }}>
              Copy the suspicious message from WhatsApp, SMS, Email, Messenger, Instagram, or another app, then paste it here for AI scanning.
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 8, lineHeight: 1.45 }}>
              In a future mobile/PWA version, users can share a message directly to JagaDuit.
            </div>
          </div>
        </div>

        {error && (
          <div style={{ margin: "16px 18px 0", padding: "10px 13px", background: "var(--risk-high-bg)", border: "1px solid rgba(196,28,51,.2)", borderRadius: "var(--r-md)", fontSize: 13, color: "var(--risk-high)" }}>
            {error}
          </div>
        )}

        <div style={{ height: 24 }} />
      </div>

      <div className="cta-bar">
        <button className="btn btn-pri" type="submit" disabled={!canAnalyze}>
          {ocrLoading ? "Extracting text..." : loading ? "Analyzing transfer risk..." : "Analyze transfer risk"}
        </button>
      </div>
    </form>
  )
}
