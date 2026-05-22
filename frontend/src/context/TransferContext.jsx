/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react"

const TransferContext = createContext(null)

export function TransferProvider({ children }) {
  const [transferData, setTransferData] = useState({
    // Mock transfer fields
    recipient: "",
    amount: "",
    purpose: "",
    // Message analysis
    suspiciousMessage: "",
    evidenceSource: "",
    // Payment context
    paymentContext: {
      recipientType: "",   // individual | business | unknown
      paymentPurpose: "",  // parcel_fee | job_fee | investment | bank_request | other
      requestSource: "",   // whatsapp | sms | telegram | email | messenger_facebook | instagram_dm | phone_call | other
      evidenceSource: "",
      urgency: "",         // low | medium | high
    },
    // Analysis results
    analysisResult: null,
  })

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
