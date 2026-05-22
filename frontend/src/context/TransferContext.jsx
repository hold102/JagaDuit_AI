import { createContext, useContext, useState } from "react"

const TransferContext = createContext(null)

export function TransferProvider({ children }) {
  const [transferData, setTransferData] = useState({
    // Mock transfer fields
    recipient: "",
    amount: "",
    // Message analysis
    suspiciousMessage: "",
    // Payment context
    paymentContext: {
      recipientType: "",   // individual | business | unknown
      paymentPurpose: "",  // parcel_fee | job_fee | investment | bank_request | other
      requestSource: "",   // whatsapp | sms | telegram | email | social_media | other
      urgency: "",         // low | medium | high
    },
    // Analysis results
    analysisResult: null,
  })

  return (
    <TransferContext.Provider value={{ transferData, setTransferData }}>
      {children}
    </TransferContext.Provider>
  )
}

export function useTransfer() {
  const ctx = useContext(TransferContext)
  if (!ctx) throw new Error("useTransfer must be used inside TransferProvider")
  return ctx
}
