import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowRightIcon,
} from "../components/icons"

const RISK_CONFIG = {
  low: {
    color: "green",
    icon: CheckCircleIcon,
    label: "Low Risk",
    headline: "Transfer looks safe",
    advice: "No major scam signals detected. Proceed with normal caution.",
    badgeClass: "risk-badge-low",
    bgClass: "bg-green-50 border-green-200",
    iconClass: "text-green-600",
  },
  medium: {
    color: "amber",
    icon: ExclamationTriangleIcon,
    label: "Medium Risk",
    headline: "Pause and verify",
    advice: "Some warning signals detected. Confirm through official channels before paying.",
    badgeClass: "risk-badge-medium",
    bgClass: "bg-amber-50 border-amber-200",
    iconClass: "text-amber-600",
  },
  high: {
    color: "red",
    icon: XCircleIcon,
    label: "High Risk",
    headline: "Do not transfer",
    advice: "Strong scam indicators detected. This transfer is likely unsafe.",
    badgeClass: "risk-badge-high",
    bgClass: "bg-red-50 border-red-200",
    iconClass: "text-red-600",
  },
}

export default function RiskResult() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult

  if (!result) {
    navigate("/transfer")
    return null
  }

  const cfg = RISK_CONFIG[result.risk_level] || RISK_CONFIG.medium
  const Icon = cfg.icon
  const score = result.risk_score ?? 0

  return (
    <div className="space-y-5">
      {/* Risk banner */}
      <div className={`card border ${cfg.bgClass}`}>
        <div className="flex items-center gap-3 mb-3">
          <Icon className={`w-8 h-8 ${cfg.iconClass}`} />
          <div>
            <span className={cfg.badgeClass}>{cfg.label}</span>
            <p className="text-lg font-bold text-gray-900 mt-1">{cfg.headline}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">{cfg.advice}</p>

        {/* Score meter */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Risk score</span>
            <span className="font-semibold">{score}/100</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                result.risk_level === "low"
                  ? "bg-green-500"
                  : result.risk_level === "medium"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scam type */}
      {result.scam_type && (
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Detected scam type
          </p>
          <p className="font-semibold text-gray-900">{result.scam_type}</p>
        </div>
      )}

      {/* Red flags */}
      {result.red_flags?.length > 0 && (
        <div className="card space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Red flags detected
          </p>
          <ul className="space-y-1.5">
            {result.red_flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-red-500 mt-0.5">•</span>
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action guide */}
      {result.action_guide?.length > 0 && (
        <div className="card space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Recommended actions
          </p>
          <ol className="space-y-2">
            {result.action_guide.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="flex-shrink-0 w-5 h-5 bg-brand-100 text-brand-700 rounded-full text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => navigate("/trusted-contact")}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          Ask a trusted contact
          <ArrowRightIcon className="w-4 h-4" />
        </button>

        {result.risk_level === "low" && (
          <button
            onClick={() => alert("Transfer confirmed (mock demo)")}
            className="btn-primary w-full"
          >
            Confirm Transfer
          </button>
        )}

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
