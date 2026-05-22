import { useNavigate, Link } from "react-router-dom"

const ACTIVITY = [
  { initials: "GH", name: "Grab Holdings", time: "Today, 09:14", amount: -24.50, incoming: false },
  { initials: "TN", name: "Tng Digital Sdn Bhd", time: "Yesterday, 18:42", amount: 500.00, incoming: true },
  { initials: "TM", name: "Telekom Malaysia", time: "22 May, 12:00", amount: -89.00, incoming: false },
  { initials: "NR", name: "Nadia Rahman", time: "21 May, 10:30", amount: 200.00, incoming: true },
]

function fmt(n) {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function BankHome() {
  const navigate = useNavigate()

  return (
    <div className="scr">
      {/* Top bar */}
      <div className="bank-topbar">
        <div className="bank-topbar-row">
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)", letterSpacing: ".01em" }}>Selamat petang,</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 1, color: "#fff" }}>Nadia Rahman</div>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <button style={{ background: "rgba(255,255,255,.08)", border: 0, width: 34, height: 34, borderRadius: 8, color: "#fff", fontSize: 16, cursor: "pointer" }}>🔔</button>
            <div className="bank-avatar">NR</div>
          </div>
        </div>
      </div>

      <div className="scr-body" style={{ paddingBottom: 20 }}>
        {/* Balance card */}
        <div className="balance-card">
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.65)", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500 }}>
            Savings Account · ····3104
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 500 }}>RM</span>
            <span style={{ fontFamily: "var(--ff-mono)", fontSize: 30, fontWeight: 600, letterSpacing: "-.02em", color: "#fff" }}>
              12,847<span style={{ color: "rgba(255,255,255,.7)" }}>.42</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 11, fontSize: 11, color: "rgba(255,255,255,.6)", fontFamily: "var(--ff-mono)" }}>
            <span>Available</span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,.35)", display: "inline-block" }} />
            <span>Updated 14:32</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="quick-grid">
          <div className="quick-item hi" onClick={() => navigate("/transfer")}>
            <div className="quick-icon">→</div>
            <div className="quick-label">Transfer</div>
          </div>
          {[
            { icon: "⊞", label: "DuitNow QR" },
            { icon: "↑", label: "Top up" },
            { icon: "⋯", label: "More" },
          ].map(({ icon, label }) => (
            <div className="quick-item" key={label}>
              <div className="quick-icon" style={{ fontSize: 14 }}>{icon}</div>
              <div className="quick-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div className="section-h">
          <h3>Recent activity</h3>
          <span className="link">See all</span>
        </div>
        <div className="act-list">
          {ACTIVITY.map((a, i) => (
            <div className="act" key={i}>
              <div className="act-ic">{a.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="act-name">{a.name}</div>
                <div className="act-meta">{a.time}</div>
              </div>
              <div className={`act-amt ${a.incoming ? "act-pos" : "act-neg"}`}>
                {a.incoming ? "+" : "−"}RM{fmt(Math.abs(a.amount))}
              </div>
            </div>
          ))}
        </div>

        {/* JagaDuit banner */}
        <div style={{ padding: "6px 18px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="dcard" style={{ padding: 13, display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--navy-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🛡️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>JagaDuit AI is on</div>
              <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>Pre-transfer scam safety is protecting this account.</div>
            </div>
            <span style={{ color: "var(--ink-400)", fontSize: 14 }}>›</span>
          </div>

          {/* Voice scan shortcut */}
          <Link to="/voice" style={{ textDecoration: "none" }}>
            <div className="dcard" style={{ padding: 13, display: "flex", alignItems: "center", gap: 11, background: "linear-gradient(135deg, var(--navy-900), var(--navy-800))", borderColor: "transparent" }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📞</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>On a suspicious call?</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginTop: 2 }}>Tap to scan the call with AI in real-time.</div>
              </div>
              <span style={{ color: "rgba(255,255,255,.4)", fontSize: 14 }}>›</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
