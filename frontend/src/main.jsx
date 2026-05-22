import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.jsx"
import { TransferProvider } from "./context/TransferContext.jsx"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TransferProvider>
      <App />
    </TransferProvider>
  </StrictMode>,
)
