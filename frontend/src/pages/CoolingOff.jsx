import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { ExclamationTriangleIcon, PhoneIcon, ArrowRightIcon } from "../components/icons"

const COOLING_SECONDS = 10

export default function CoolingOff() {
  const navigate = useNavigate()
  const { transferData } = useTransfer()
  const result = transferData.analysisResult

  const [countdown, setCountdown] = useState(COOLING_SECONDS)
  const [cooled, setCooled] = useState(false)

  useEffect(() => {
    if (countdown <= 0) {
      setCooled(true)
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  if (!result) {
    navigate("/transfer")
    return null
  }

  return (
    <div className="space-y-5">
      {/* Alert banner */}
      <div className="card border-red-200 bg-red-50 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-red-800">Cooling-Off Mode</h1>
        <p className="text-sm text-red-700 mt-1">
          High scam risk detected. Please pause and review before transferring.
        </p>
      </div>

      {/* Countdown */}
      <div className="card text-center">
        {!cooled ? (
          <>
            <p className="text-sm text-gray-500 mb-2">Transfer locked for</p>
            <div className="text-6xl font-bold text-red-500 tabular-nums">{countdown}</div>
            <p className="text-sm text-gray-400 mt-2">seconds</p>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-4">
              <div
                className="h-1.5 rounded-full bg-red-500 transition-all duration-1000"
                style={{ width: `${((COOLING_SECONDS - countdown) / COOLING_SECONDS) * 100}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600 font-medium">
            Cooling-off period complete. You may now review the result.
          </p>
        )}
      </div>

      {/* Scam summary */}
      {result.scam_type && (
        <div className="card border-red-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Scam type detected
          </p>
          <p className="font-semibold text-gray-900">{result.scam_type}</p>
          {result.red_flags?.slice(0, 3).map((f, i) => (
            <p key={i} className="text-sm text-red-700 mt-1 flex items-start gap-1.5">
              <span className="text-red-400">•</span> {f}
            </p>
          ))}
        </div>
      )}

      {/* Emergency contact */}
      <div className="card bg-gray-900 border-0 text-white">
        <div className="flex items-center gap-3 mb-2">
          <PhoneIcon className="w-5 h-5 text-white" />
          <p className="font-semibold">Been scammed? Call NSRC</p>
        </div>
        <p className="text-3xl font-bold">997</p>
        <p className="text-xs text-gray-400 mt-1">National Scam Response Centre — available 24/7</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          disabled={!cooled}
          onClick={() => navigate("/result")}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
        >
          View full risk report
          <ArrowRightIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate("/trusted-contact")}
          className="btn-secondary w-full"
        >
          Ask a trusted contact first
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
