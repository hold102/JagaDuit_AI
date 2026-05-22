import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { analyzeTransfer, telegramSessionStatus, telegramChats, telegramAnalyze } from "../utils/api"

const SOURCES = ["WhatsApp", "SMS", "Telegram", "Email", "Other"]

export default function CheckBeforePay() {
  const navigate = useNavigate()
  const { transferData, setTransferData } = useTransfer()

  const [step, setStep] = useState("paste") // paste | context
  const [message, setMessage] = useState(transferData.suspiciousMessage || "")
  const [source, setSource] = useState("")
  const [ctx, setCtx] = useState({ knowRecipient: "", urgency: "", askedCreds: "", hadLink: "" })

  // Telegram auto-scan state
  const [tgPhone, setTgPhone] = useState(localStorage.getItem("tg_phone") || "")
  const [tgChats, setTgChats] = useState([])
  const [tgReady, setTgReady] = useState(false)

  useEffect(() => {
    if (source !== "Telegram") return
    const saved = localStorage.getItem("tg_phone")
    if (!saved) return
    telegramSessionStatus(saved)
      .then(({ authenticated }) => {
        if (authenticated) {
          setTgReady(true)
          return telegramChats(saved).then(({ chats }) => setTgChats(chats))
        }
      })
      .catch(() => {})
  }, [source])

  function handleTgSelect(chat) {
    setTransferData(prev => ({ ...prev, recipient: chat.name }))
    navigate("/analyzing", { state: { telegram: { phone: tgPhone, chatId: chat.id, chatName: chat.name, chatKind: chat.kind } } })
  }

  function handleAnalyze() {
    setTransferData(prev => ({ ...prev, suspiciousMessage: message }))
    navigate("/analyzing", { state: { message, source, ctx } })
  }

  function Tile({ field, val, label }) {
    return (
      <div className={`radio-tile ${ctx[field] === val ? "active" : ""}`} onClick={() => setCtx(c => ({ ...c, [field]: val }))}>
        <div className="radio-check" />
        <span>{label}</span>
      </div>
    )
  }

  if (step === "context") {
    const allDone = ctx.knowRecipient && ctx.urgency && ctx.askedCreds && ctx.hadLink
    return (
      <div className="scr">
        <div className="scr-header scr-header-dark">
          <button className="back-btn back-btn-dark" onClick={() => setStep("paste")}>‹</button>
          <div style={{ flex: 1 }}>
            <div className="hdr-title hdr-title-white" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              🛡️ <span>JagaDuit Safety Check</span>
            </div>
            <div className="hdr-sub hdr-sub-white">Pre-transfer protection · 2. Context</div>
          </div>
        </div>

        <div className="scr-body">
          <div className="steps-row">
            {[0, 1, 2].map(i => <div key={i} className={`step-dot ${i === 1 ? "active" : i < 1 ? "done" : ""}`} />)}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-500)", fontFamily: "var(--ff-mono)" }}>Step 2 of 3</span>
          </div>

          <div style={{ padding: "15px 18px 0" }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.015em", lineHeight: 1.25 }}>A few questions about the transfer.</div>
            <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 5, lineHeight: 1.45 }}>We combine your answers with the message to give an accurate risk score.</div>
          </div>

          <div style={{ padding: "18px 18px 0", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="field-lbl" style={{ marginBottom: 7 }}>Do you personally know the recipient?</div>
              <div className="radio-grid">
                <Tile field="knowRecipient" val="yes" label="Yes, I know them" />
                <Tile field="knowRecipient" val="no" label="No, first time" />
              </div>
            </div>
            <div>
              <div className="field-lbl" style={{ marginBottom: 7 }}>How urgent did the message feel?</div>
              <div className="radio-grid radio-grid-3">
                <Tile field="urgency" val="low" label="Low" />
                <Tile field="urgency" val="medium" label="Medium" />
                <Tile field="urgency" val="high" label="High" />
              </div>
            </div>
            <div>
              <div className="field-lbl" style={{ marginBottom: 7 }}>Did the message ask for a TAC, PIN or password?</div>
              <div className="radio-grid">
                <Tile field="askedCreds" val="yes" label="Yes" />
                <Tile field="askedCreds" val="no" label="No" />
              </div>
            </div>
            <div>
              <div className="field-lbl" style={{ marginBottom: 7 }}>Did it contain a link to click?</div>
              <div className="radio-grid">
                <Tile field="hadLink" val="yes" label="Yes" />
                <Tile field="hadLink" val="no" label="No" />
              </div>
            </div>
          </div>

          <div style={{ padding: "16px 18px" }}>
            <div className="dcard" style={{ padding: 12, display: "flex", gap: 10, alignItems: "flex-start", background: "var(--navy-25)", borderColor: "var(--navy-50)" }}>
              <span style={{ fontSize: 14, marginTop: 1 }}>ℹ️</span>
              <div style={{ fontSize: 11, color: "var(--navy-800)", lineHeight: 1.45 }}>
                <strong style={{ display: "block", marginBottom: 2 }}>Why we ask</strong>
                Context matters. The same message can be safe between friends or dangerous from a stranger.
              </div>
            </div>
          </div>
        </div>

        <div className="cta-bar">
          <button className="btn btn-pri" disabled={!allDone} onClick={handleAnalyze}>
            Calculate risk score <span style={{ fontSize: 16 }}>›</span>
          </button>
        </div>
      </div>
    )
  }

  // Paste step
  return (
    <div className="scr">
      <div className="scr-header scr-header-dark">
        <button className="back-btn back-btn-dark" onClick={() => navigate("/transfer")}>‹</button>
        <div style={{ flex: 1 }}>
          <div className="hdr-title hdr-title-white" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            🛡️ <span>JagaDuit Safety Check</span>
          </div>
          <div className="hdr-sub hdr-sub-white">Pre-transfer protection · 1. Message</div>
        </div>
      </div>

      <div className="scr-body">
        <div className="steps-row">
          {[0, 1, 2].map(i => <div key={i} className={`step-dot ${i === 0 ? "active" : ""}`} />)}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-500)", fontFamily: "var(--ff-mono)" }}>Step 1 of 3</span>
        </div>

        <div style={{ padding: "15px 18px 0" }}>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.015em", lineHeight: 1.25 }}>Paste the message that asked you to transfer.</div>
          <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 5, lineHeight: 1.45 }}>Our AI reads scam patterns: urgency, impersonation, fake links, credential requests.</div>
        </div>

        {/* Source chips */}
        <div style={{ padding: "16px 18px 0" }}>
          <div className="field-lbl" style={{ marginBottom: 7 }}>Where did it come from?</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SOURCES.map(s => (
              <div key={s} className={`chip ${source === s ? "active" : ""}`} onClick={() => setSource(s)}>{s}</div>
            ))}
          </div>
        </div>

        {/* Telegram auto-scan */}
        {source === "Telegram" && (
          <div style={{ padding: "14px 18px 0" }}>
            {tgReady && tgChats.length > 0 ? (
              <div className="dcard" style={{ overflow: "hidden" }}>
                <div style={{ padding: "11px 14px 8px", borderBottom: "1px solid var(--ink-100)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-500)" }}>Select chat to scan automatically</div>
                  <div style={{ fontSize: 11, color: "var(--ink-400)", marginTop: 2 }}>AI reads last 50 messages — no copy-paste needed</div>
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {tgChats.map(chat => (
                    <button key={chat.id} onClick={() => handleTgSelect(chat)}
                      style={{ all: "unset", width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", borderBottom: "1px solid var(--ink-100)", cursor: "pointer", boxSizing: "border-box" }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--navy-50)", color: "var(--navy-800)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                        {chat.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chat.name}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 1, textTransform: "capitalize" }}>{chat.kind}</div>
                      </div>
                      {chat.unread > 0 && <span style={{ background: "var(--navy-800)", color: "#fff", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 100 }}>{chat.unread}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="dcard" style={{ padding: 14, display: "flex", gap: 11, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>✈️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>Scan Telegram automatically</div>
                  <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>Connect your Telegram account to scan without copy-paste.</div>
                </div>
                <button onClick={() => navigate("/telegram")}
                  style={{ background: "var(--navy-800)", color: "#fff", border: 0, borderRadius: 8, padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Connect
                </button>
              </div>
            )}
            <div style={{ marginTop: 12, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: "var(--ink-100)" }} />
              <span style={{ fontSize: 11, color: "var(--ink-400)", flexShrink: 0 }}>or paste manually</span>
              <div style={{ flex: 1, height: 1, background: "var(--ink-100)" }} />
            </div>
          </div>
        )}

        {/* Paste area */}
        <div style={{ padding: "14px 18px 0" }}>
          <div className="field-lbl" style={{ marginBottom: 7, display: "flex", justifyContent: "space-between" }}>
            <span>Message content</span>
            <span style={{ color: "var(--ink-400)", fontFamily: "var(--ff-mono)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>{message.length} chars</span>
          </div>
          <textarea className="paste-area" value={message} onChange={e => setMessage(e.target.value)} placeholder="Paste the suspicious message here…" />
          <div style={{ fontSize: 11, color: "var(--ink-400)", marginTop: 7, display: "flex", alignItems: "center", gap: 5 }}>
            🔒 <span>End-to-end encrypted · We never store your message content.</span>
          </div>
        </div>

        <div style={{ height: 24 }} />
      </div>

      <div className="cta-bar">
        <button className="btn btn-pri" disabled={message.trim().length < 10} onClick={() => setStep("context")}>
          ✨ Analyze with JagaDuit AI
        </button>
      </div>
    </div>
  )
}
