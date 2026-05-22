import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { analyzeTransfer } from "../utils/api"
import { ShieldCheckIcon } from "../components/icons"

const DEMO_MESSAGE =
  "Notis: Penghantaran parcel anda (MY-4821093) telah ditahan di pusat logistik kami. Bayaran penghantaran sebanyak RM 4.80 perlu dibuat dalam masa 24 jam atau parcel akan dikembalikan. Klik pautan untuk bayar: http://posmalaysia-delivery.xyz/pay"

const RECIPIENT_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "business", label: "Business" },
  { value: "unknown", label: "Unknown / Not sure" },
]

const PAYMENT_PURPOSES = [
  { value: "parcel_fee", label: "Parcel / delivery fee" },
  { value: "job_fee", label: "Job registration fee" },
  { value: "investment", label: "Investment / profit share" },
  { value: "bank_request", label: "Bank freeze / account verification" },
  { value: "other", label: "Other" },
]

const REQUEST_SOURCES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email" },
  { value: "social_media", label: "Social media" },
  { value: "other", label: "Other" },
]

export default function CheckBeforePay() {
  const navigate = useNavigate()
  const { transferData, setTransferData } = useTransfer()

  const [message, setMessage] = useState(transferData.suspiciousMessage || "")
  const [context, setContext] = useState(transferData.paymentContext)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function updateContext(key, value) {
    setContext((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAnalyze(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const result = await analyzeTransfer({
        message,
        payment_context: {
          recipient: transferData.recipient,
          amount: transferData.amount,
          ...context,
        },
      })
      setTransferData((prev) => ({
        ...prev,
        suspiciousMessage: message,
        paymentContext: context,
        analysisResult: result,
      }))
      if (result.risk_level === "high") {
        navigate("/cooling-off")
      } else {
        navigate("/result")
      }
    } catch (err) {
      setError("Analysis failed. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheckIcon className="w-6 h-6 text-brand-600" />
          Check Before You Pay
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste the message you received. Our AI will flag scam signals before you confirm the transfer.
        </p>
      </div>

      <form onSubmit={handleAnalyze} className="space-y-4">
        {/* Message input */}
        <div className="card space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Suspicious message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
            placeholder="Paste WhatsApp, SMS, Telegram, or any message here..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <button
            type="button"
            onClick={() => setMessage(DEMO_MESSAGE)}
            className="text-xs text-brand-600 underline"
          >
            Use demo parcel scam message
          </button>
        </div>

        {/* Payment context */}
        <div className="card space-y-4">
          <p className="text-sm font-semibold text-gray-700">Payment context</p>

          <SelectField
            label="Recipient type"
            value={context.recipientType}
            onChange={(v) => updateContext("recipientType", v)}
            options={RECIPIENT_TYPES}
          />
          <SelectField
            label="Payment purpose"
            value={context.paymentPurpose}
            onChange={(v) => updateContext("paymentPurpose", v)}
            options={PAYMENT_PURPOSES}
          />
          <SelectField
            label="Request came from"
            value={context.requestSource}
            onChange={(v) => updateContext("requestSource", v)}
            options={REQUEST_SOURCES}
          />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">How urgent did it feel?</p>
            <div className="flex gap-2">
              {["low", "medium", "high"].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => updateContext("urgency", u)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-colors ${
                    context.urgency === u
                      ? u === "low"
                        ? "bg-green-100 border-green-400 text-green-800"
                        : u === "medium"
                        ? "bg-amber-100 border-amber-400 text-amber-800"
                        : "bg-red-100 border-red-400 text-red-800"
                      : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !message}
          className="btn-primary w-full"
        >
          {loading ? "Analysing…" : "Analyse Transfer Safety"}
        </button>
      </form>
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
