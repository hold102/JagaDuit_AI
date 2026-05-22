import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
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

export default api
