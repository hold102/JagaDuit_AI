import axios from "axios"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001"

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

/**
 * Analyze a suspicious message and payment context.
 * Returns { scam_type, red_flags, risk_score, risk_level, action_guide, trusted_contact_message }
 */
export async function analyzeTransfer(payload) {
  const { data } = await api.post("/api/analyze", payload)
  return data
}

export async function analyzeChat(payload) {
  const { data } = await api.post("/api/analyze-chat", payload)
  return data
}

export async function analyzeCall(payload) {
  const { data } = await api.post("/api/analyze-call", payload)
  return data
}

export async function telegramSessionStatus(phone) {
  const { data } = await api.get("/api/telegram/session-status", { params: { phone } })
  return data
}

export async function telegramConnect(phone) {
  const { data } = await api.post("/api/telegram/connect", { phone })
  return data
}

export async function telegramVerify(phone, code) {
  const { data } = await api.post("/api/telegram/verify", { phone, code })
  return data
}

export async function telegramVerify2FA(phone, password) {
  const { data } = await api.post("/api/telegram/verify-2fa", { phone, password })
  return data
}

export async function telegramChats(phone) {
  const { data } = await api.post("/api/telegram/chats", { phone })
  return data
}

export async function telegramAnalyze(phone, chat_id, chat_name) {
  const { data } = await api.post("/api/telegram/analyze", { phone, chat_id, chat_name }, { timeout: 60000 })
  return data
}

export default api
