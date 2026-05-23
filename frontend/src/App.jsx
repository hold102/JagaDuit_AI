import { BrowserRouter, Routes, Route } from "react-router-dom"
import Layout from "./components/Layout"
import BankHome from "./pages/BankHome"
import TransferFlow from "./pages/TransferFlow"
import CheckBeforePay from "./pages/CheckBeforePay"
import ChatScan from "./pages/ChatScan"
import Analyzing from "./pages/Analyzing"
import SafeProceed from "./pages/SafeProceed"
import CoolingOff from "./pages/CoolingOff"
import ActionGuide from "./pages/ActionGuide"
import TransferSuccess from "./pages/TransferSuccess"
import TransferCancelled from "./pages/TransferCancelled"
import TelegramScan from "./pages/TelegramScan"
import TelegramResult from "./pages/TelegramResult"
import VoiceScan from "./pages/VoiceScan"
import GmailScan from "./pages/GmailScan"
import { TransferProvider } from "./context/TransferContext"

export default function App() {
  return (
    <TransferProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<BankHome />} />
            <Route path="transfer" element={<TransferFlow />} />
            <Route path="check" element={<CheckBeforePay />} />
            <Route path="chat-scan" element={<ChatScan />} />
            <Route path="analyzing" element={<Analyzing />} />
            <Route path="safe" element={<SafeProceed />} />
            <Route path="cooling-off" element={<CoolingOff />} />
            <Route path="actions" element={<ActionGuide />} />
            <Route path="success" element={<TransferSuccess />} />
            <Route path="cancelled" element={<TransferCancelled />} />
            <Route path="telegram" element={<TelegramScan />} />
            <Route path="telegram-result" element={<TelegramResult />} />
            <Route path="voice" element={<VoiceScan />} />
            <Route path="gmail" element={<GmailScan />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TransferProvider>
  )
}
