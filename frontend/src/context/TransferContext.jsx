/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react"

const TransferContext = createContext(null)

export function TransferProvider({ children }) {
  const [transferData, setTransferData] = useState({
    // Mock transfer fields — pre-populated by TransferFlow and carried through the scan flow
    recipient: "",
    amount: "",
    purpose: "",
    // Message analysis
    suspiciousMessage: "",
    evidenceSource: "",
    // Payment context — mirrors the PaymentContext Pydantic model in routes/analyze.py
    paymentContext: {
      recipientType: "",   // individual | business | unknown
      paymentPurpose: "",  // parcel_fee | job_fee | investment | bank_request | other
      requestSource: "",   // whatsapp | sms | telegram | email | messenger_facebook | instagram_dm | phone_call | other
      evidenceSource: "",
      urgency: "",         // low | medium | high
    },
    // Populated by Analyzing.jsx after the backend API call resolves
    analysisResult: null,
  })

  // Helper that keeps evidenceSource in sync at both the top level and inside paymentContext,
  // because the backend reads from both locations depending on the route called.
  function setEvidenceSource(evidenceSource) {
    setTransferData(prev => ({
      ...prev,
      evidenceSource,
      paymentContext: {
        ...prev.paymentContext,
        requestSource: evidenceSource,
        evidenceSource,
      },
    }))
  }

  return (
    <TransferContext.Provider value={{ transferData, setTransferData, setEvidenceSource }}>
      {children}
    </TransferContext.Provider>
  )
}

export function useTransfer() {
  const ctx = useContext(TransferContext)
  if (!ctx) throw new Error("useTransfer must be used inside TransferProvider")
  return ctx
}
