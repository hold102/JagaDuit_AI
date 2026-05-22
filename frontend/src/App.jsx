import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import TransferFlow from "./pages/TransferFlow"
import CheckBeforePay from "./pages/CheckBeforePay"
import RiskResult from "./pages/RiskResult"
import CoolingOff from "./pages/CoolingOff"
import TrustedContact from "./pages/TrustedContact"
import Layout from "./components/Layout"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/transfer" replace />} />
          <Route path="transfer" element={<TransferFlow />} />
          <Route path="check" element={<CheckBeforePay />} />
          <Route path="result" element={<RiskResult />} />
          <Route path="cooling-off" element={<CoolingOff />} />
          <Route path="trusted-contact" element={<TrustedContact />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
