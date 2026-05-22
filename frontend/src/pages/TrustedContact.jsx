import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { UserGroupIcon, ArrowRightIcon } from "../components/icons"

export default function TrustedContact() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult
  const [copied, setCopied] = useState(false)

  const message =
    result?.trusted_contact_message ||
    buildDefaultMessage(transferData)

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <UserGroupIcon className="w-6 h-6 text-brand-600" />
          Ask a Trusted Contact
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Before you pay, send this message to a family member or friend for a second opinion.
        </p>
      </div>

      {/* Generated message */}
      <div className="card space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Copy this message
        </p>
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed border border-gray-200">
          {message}
        </div>
        <button onClick={handleCopy} className="btn-secondary w-full">
          {copied ? "Copied!" : "Copy message"}
        </button>
      </div>

      {/* Share buttons (mock) */}
      <div className="card space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Share via
        </p>
        <div className="grid grid-cols-2 gap-2">
          {["WhatsApp", "Telegram", "SMS", "Email"].map((app) => (
            <button
              key={app}
              onClick={() => alert(`Open ${app} (mock demo)`)}
              className="btn-secondary text-sm py-2"
            >
              {app}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => navigate("/result")}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          Back to risk report
          <ArrowRightIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate("/transfer")}
          className="text-sm text-gray-400 text-center underline"
        >
          Cancel transfer
        </button>
      </div>
    </div>
  )
}

function buildDefaultMessage(transferData) {
  const { recipient, amount, paymentContext, suspiciousMessage } = transferData
  return `Hi, I need your advice before I make a payment.

I received a message asking me to transfer RM ${amount || "???"} to "${recipient || "???"}".

The message says:
"${suspiciousMessage?.slice(0, 200) || ""}${suspiciousMessage?.length > 200 ? "…" : ""}"

It came via ${paymentContext?.requestSource || "unknown channel"} and felt ${paymentContext?.urgency || "urgent"}.

JagaDuit AI flagged this as potentially suspicious. Can you help me check if this looks legitimate?

— Checked with JagaDuit AI`
}
