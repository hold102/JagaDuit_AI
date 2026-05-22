import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTransfer } from "../context/TransferContext"
import { ShieldCheckIcon, ArrowRightIcon } from "../components/icons"

// Mock banking contacts
const CONTACTS = [
  { id: 1, name: "Ahmad Rizal", account: "****1234" },
  { id: 2, name: "Siti Nadia", account: "****5678" },
  { id: 3, name: "Unknown Parcel Co.", account: "****9999" },
]

export default function TransferFlow() {
  const navigate = useNavigate()
  const { transferData, setTransferData } = useTransfer()
  const [recipient, setRecipient] = useState(transferData.recipient || "")
  const [amount, setAmount] = useState(transferData.amount || "")
  const [selectedContact, setSelectedContact] = useState(null)

  function handleProceed(e) {
    e.preventDefault()
    setTransferData((prev) => ({ ...prev, recipient, amount }))
    navigate("/check")
  }

  return (
    <div className="space-y-6">
      {/* Bank header mock */}
      <div className="card bg-gradient-to-br from-brand-600 to-brand-700 text-white border-0">
        <p className="text-sm opacity-80">Mock Banking App</p>
        <p className="text-2xl font-bold mt-1">RM 3,240.00</p>
        <p className="text-sm opacity-70 mt-0.5">Available balance</p>
      </div>

      <form onSubmit={handleProceed} className="space-y-4">
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Transfer Money</h2>

          {/* Quick-select contacts */}
          <div>
            <p className="text-sm text-gray-500 mb-2">Recent contacts</p>
            <div className="space-y-2">
              {CONTACTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedContact(c.id)
                    setRecipient(c.name)
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                    selectedContact === c.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.account}</p>
                  </div>
                  {selectedContact === c.id && (
                    <span className="text-brand-600 text-xs font-semibold">Selected</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Or manual entry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient name / account
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value)
                setSelectedContact(null)
              }}
              placeholder="Enter name or account number"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (RM)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="1"
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Safety CTA */}
        <div className="card border-amber-200 bg-amber-50">
          <div className="flex gap-3 items-start">
            <ShieldCheckIcon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Check Before You Pay</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Received a message asking you to pay? Paste it below for an AI safety check before confirming.
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!amount || !recipient}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          Continue to Safety Check
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
