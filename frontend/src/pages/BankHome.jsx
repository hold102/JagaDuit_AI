import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

/* ──────────────── Icons (stroke-based) ──────────────── */
const Icon = ({ size = 22, stroke = "currentColor", sw = 1.8, d, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
)
const IconHouse = (p) => <Icon {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
const IconCards = (p) => <Icon {...p}><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10.5h19" /><path d="M6 15.5h4" /></Icon>
const IconChart = (p) => <Icon {...p}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-8" /><path d="M22 20H2" /></Icon>
const IconUser  = (p) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.2-4 4.4-6 8-6s6.8 2 8 6" /></Icon>
const IconShieldCheck = (p) => <Icon {...p}><path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z" /><path d="m8.5 12 2.5 2.5L15.5 10" /></Icon>
const IconArrowDown = (p) => <Icon {...p} d="M12 5v14M5 12l7 7 7-7" />
const IconPlus = (p) => <Icon {...p} d="M12 5v14M5 12h14" />
const IconQR = (p) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v3M14 18v3h3M21 21h-3" /></Icon>
const IconSend = (p) => <Icon {...p} d="m4 12 17-8-7 18-2.5-7.5z M11.5 14.5 21 4" />
const IconBolt = (p) => <Icon {...p} d="m13 2-9 12h7l-1 8 9-12h-7z" />
const IconBell = (p) => <Icon {...p}><path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 8H4c0-2 2-3 2-8Z" /><path d="M10 21a2 2 0 0 0 4 0" /></Icon>
const IconChevronRight = (p) => <Icon {...p} d="m9 6 6 6-6 6" />
const IconEye = (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Icon>
const IconEyeOff = (p) => <Icon {...p}><path d="M3 3l18 18" /><path d="M10.6 6.1A10 10 0 0 1 22 12s-1 2-3 4M14 14a3 3 0 0 1-4-4M6 6c-2.4 1.6-4 6-4 6s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2" /></Icon>
const IconFood = (p) => <Icon {...p}><path d="M4 3v7a3 3 0 0 0 3 3v8M7 3v7M10 3v7" /><path d="M16 3c-2 0-3 3-3 6s1 4 3 4v8" /></Icon>
const IconCar  = (p) => <Icon {...p}><path d="M3 13l2-5a3 3 0 0 1 3-2h8a3 3 0 0 1 3 2l2 5v5h-3v-2H6v2H3z" /><circle cx="7" cy="16" r="1.3" /><circle cx="17" cy="16" r="1.3" /></Icon>
const IconBag  = (p) => <Icon {...p}><path d="M5 8h14l-1 12H6z" /><path d="M9 8a3 3 0 0 1 6 0" /></Icon>
const IconFilm = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 14h4M17 9h4M17 14h4" /></Icon>
const IconWallet = (p) => <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h11l3 4v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 9h14" /><circle cx="16" cy="13" r="1" fill="currentColor" stroke="none" /></Icon>
const IconBuilding = (p) => <Icon {...p}><path d="M4 21V5l8-2v18M12 9h8v12M8 8h0M8 12h0M8 16h0M16 13h0M16 17h0" /></Icon>
const IconShieldX = (p) => <Icon {...p}><path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z" /></Icon>
const IconLock = (p) => <Icon {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>
const IconPhone = (p) => <Icon {...p} d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />

/* ──────────────── Data ──────────────── */
const accounts = [
  { id: "main",    type: "Everyday",  name: "JagaDuit Debit", last4: "4729", balance: 12847.50, network: "Mastercard", gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 35%, #0f3460 70%, #533483 100%)" },
  { id: "savings", type: "Savings",   name: "Hajj Fund",      last4: "2018", balance: 24380.00, network: "Savings",    gradient: "linear-gradient(135deg, #064e3b 0%, #047857 40%, #0d9488 75%, #14b8a6 100%)" },
  { id: "invest",  type: "Invest",    name: "ASB Portfolio",  last4: "0091", balance:  8412.75, network: "Portfolio",  gradient: "linear-gradient(135deg, #3b0764 0%, #6b21a8 40%, #be185d 80%, #f43f5e 100%)" },
]

const transactions = [
  { id: "t1", merchant: "Grab", sub: "Transport • KL Sentral → Bangsar", amount: -18.50, time: "Just now", icon: IconCar, iconBg: "linear-gradient(135deg,#10b981,#059669)" },
  { id: "t2", merchant: "Shopee Malaysia", sub: "Shopping • Order #SP2419", amount: -245.00, time: "2h ago", icon: IconBag, iconBg: "linear-gradient(135deg,#f97316,#ea580c)" },
  { id: "t3", merchant: "Unknown Merchant", sub: "Foreign • Stripe·XK", amount: -892.00, time: "4h ago", icon: IconShieldX, iconBg: "linear-gradient(135deg,#f43f5e,#be123c)", flagged: true, blocked: true },
  { id: "t4", merchant: "Restoran Nasi Kandar", sub: "Food • Jalan Tunku", amount: -32.40, time: "Yesterday", icon: IconFood, iconBg: "linear-gradient(135deg,#fbbf24,#d97706)" },
  { id: "t5", merchant: "Salary — Petronas", sub: "Income • Direct deposit", amount: 7200.00, time: "Yesterday", icon: IconBuilding, iconBg: "linear-gradient(135deg,#22d3ee,#0891b2)" },
  { id: "t6", merchant: "Netflix", sub: "Subscription • Premium plan", amount: -54.90, time: "2 days ago", icon: IconFilm, iconBg: "linear-gradient(135deg,#dc2626,#991b1b)" },
]

const spendPoints = [120, 245, 88, 410, 175, 322, 296]
const spendByCategory = [
  { label: "Food",          value: 612, color: "#fbbf24" },
  { label: "Transport",     value: 388, color: "#10b981" },
  { label: "Shopping",      value: 745, color: "#f97316" },
  { label: "Bills",         value: 410, color: "#06b6d4" },
  { label: "Entertainment", value: 198, color: "#ec4899" },
]

/* ──────────────── Helpers ──────────────── */
function useAnimatedNumber(target, duration = 1100) {
  const [val, setVal] = useState(target)
  const fromRef = useRef(target)
  const startRef = useRef(performance.now())
  useEffect(() => {
    fromRef.current = val
    startRef.current = performance.now()
    let raf
    const tick = () => {
      const now = performance.now()
      const t = Math.min(1, (now - startRef.current) / duration)
      const eased = 1 - Math.pow(1 - t, 4)
      setVal(fromRef.current + (target - fromRef.current) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line
  }, [target])
  return val
}

const fmtRM = (n, { hide = false, sign = false } = {}) => {
  if (hide) return "••••••"
  const abs = Math.abs(n)
  const s = abs.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const prefix = sign ? (n >= 0 ? "+" : "−") : (n < 0 ? "−" : "")
  return `${prefix}RM ${s}`
}

/* ──────────────── Card stack ──────────────── */
function AccountCardFace({ acc, hidden }) {
  return (
    <div style={{
      width: "100%", height: 180, borderRadius: 22,
      background: acc.gradient, position: "relative", overflow: "hidden",
      boxShadow: "0 30px 50px -25px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.25)",
      color: "#fff", padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 60% at 0% 0%, rgba(255,255,255,0.25) 0%, transparent 50%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "-20%", width: "35%", background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)", transform: "skewX(-12deg)", pointerEvents: "none" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 10, opacity: 0.72, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700 }}>{acc.type}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 3 }}>{acc.name}</div>
        </div>
        <div style={{ width: 28, height: 20, borderRadius: 4, background: "linear-gradient(135deg, #fde68a 0%, #d97706 50%, #a16207 100%)", position: "relative" }}>
          <div style={{ position: "absolute", inset: 3, border: ".5px solid rgba(0,0,0,.35)", borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 9.5, opacity: 0.7, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700 }}>Available</div>
        <div className="lg-tnum" style={{ fontSize: 26, fontWeight: 700, marginTop: 2, lineHeight: 1.05 }}>
          {fmtRM(acc.balance, { hide: hidden })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", position: "relative", zIndex: 1 }}>
        <div className="lg-tnum" style={{ fontSize: 12, letterSpacing: ".22em", opacity: 0.85, fontWeight: 500 }}>•••• {acc.last4}</div>
        <div style={{ fontSize: 11, opacity: 0.78, fontStyle: "italic", fontWeight: 700 }}>{acc.network}</div>
      </div>
    </div>
  )
}

function CardStack({ accounts, activeIdx, setActiveIdx, hidden }) {
  const ordered = useMemo(() => {
    const a = [...accounts]
    const head = a.splice(activeIdx, 1)[0]
    return [head, ...a]
  }, [accounts, activeIdx])
  const cardH = 180, peek = 20
  const stackH = cardH + peek * (accounts.length - 1) + 8
  return (
    <div className="lg-card-stack" style={{ height: stackH, margin: "0 18px" }}>
      {ordered.map((acc, i) => {
        const y = i * peek, scale = 1 - i * 0.04
        const realIdx = accounts.findIndex(a => a.id === acc.id)
        return (
          <div key={acc.id} className="lg-acc-card" onClick={() => setActiveIdx(realIdx)} style={{
            transform: `translateY(${y}px) scale(${scale})`,
            zIndex: 10 - i, opacity: i > 2 ? 0 : 1,
            filter: i === 0 ? "none" : `brightness(${0.85 - i * 0.08})`,
          }}>
            <AccountCardFace acc={acc} hidden={hidden && i === 0} />
          </div>
        )
      })}
    </div>
  )
}

/* ──────────────── Quick action ──────────────── */
function QuickAction({ icon: Ico, label, tone = "neutral", onClick }) {
  const tones = {
    neutral: { bg: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", glow: "rgba(99,102,241,0.45)" },
    teal:    { bg: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", glow: "rgba(20,184,166,0.45)" },
    amber:   { bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", glow: "rgba(245,158,11,0.45)" },
    rose:    { bg: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)", glow: "rgba(236,72,153,0.45)" },
    red:     { bg: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)", glow: "rgba(239,68,68,0.45)" },
  }
  const t = tones[tone] || tones.neutral
  return (
    <button className="lg-tap" onClick={onClick} style={{
      flex: 1, display: "flex", flexDirection: "row", alignItems: "center", gap: 12,
      padding: "14px 18px", background: "rgba(255,255,255,0.06)",
      border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20,
      backdropFilter: "blur(20px)", cursor: "pointer", color: "#fff",
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 14, background: t.bg, flexShrink: 0,
        border: ".5px solid rgba(255,255,255,.25)", display: "grid", placeItems: "center",
        boxShadow: `inset 0 1.5px 0 rgba(255,255,255,.35), inset 0 -1px 0 rgba(0,0,0,.15), 0 8px 20px -6px ${t.glow}, 0 2px 6px -2px rgba(0,0,0,.4)`,
      }}>
        <Ico size={22} stroke="#fff" sw={2.2} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{label}</div>
    </button>
  )
}

/* ──────────────── Shield card ──────────────── */
function ShieldRing() {
  return (
    <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "conic-gradient(from 0deg, rgba(94,234,212,0.9), rgba(124,58,237,0.7), rgba(236,72,153,0.6), rgba(94,234,212,0.9))",
        animation: "lg-shimmer 8s linear infinite",
      }} />
      <div style={{
        position: "absolute", inset: 3, borderRadius: "50%",
        background: "rgba(10,10,15,0.55)", backdropFilter: "blur(20px)",
        display: "grid", placeItems: "center", border: ".5px solid rgba(255,255,255,.18)",
      }}>
        <IconShieldCheck size={24} stroke="#5eead4" sw={2.2} />
      </div>
    </div>
  )
}

function ShieldStat({ value, suffix, label, tone }) {
  const tones = {
    teal:   { glow: "rgba(94,234,212,0.25)",  text: "#5eead4" },
    amber:  { glow: "rgba(251,191,36,0.25)",  text: "#fbbf24" },
    violet: { glow: "rgba(196,181,253,0.25)", text: "#c4b5fd" },
  }
  const t = tones[tone]
  return (
    <div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(255,255,255,.06)", border: ".5px solid rgba(255,255,255,.12)" }}>
      <div className="lg-tnum" style={{ fontSize: 18, fontWeight: 700, color: t.text, textShadow: `0 0 20px ${t.glow}` }}>
        {value}{suffix && <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,.55)", marginTop: 2, lineHeight: 1.2 }}>{label}</div>
    </div>
  )
}

function ShieldCard({ onOpen }) {
  const saved = useAnimatedNumber(1051, 1400)
  return (
    <div className="lg-glass-strong lg-tap" onClick={onOpen} style={{ margin: "0 18px", padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -80, right: -80, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(94,234,212,.45) 0%, transparent 60%)", filter: "blur(20px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -90, left: -50, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,.35) 0%, transparent 60%)", filter: "blur(20px)", pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div className="lg-live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 12px #34d399" }} />
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: "rgba(94,234,212,.95)" }}>JagaDuit Shield</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.15 }}>
            Actively protecting your<br />money in real-time
          </div>
        </div>
        <ShieldRing />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16, position: "relative" }}>
        <ShieldStat value="02" label="Blocked this week" tone="teal" />
        <ShieldStat value={`RM ${saved.toFixed(0)}`} label="Saved from fraud" tone="amber" />
        <ShieldStat value="98" suffix="/100" label="Trust score" tone="violet" />
      </div>
    </div>
  )
}

/* ──────────────── Spend chart ──────────────── */
function SpendChart() {
  const total = spendPoints.reduce((s, p) => s + p, 0)
  const animTotal = useAnimatedNumber(total, 1200)
  const max = Math.max(...spendPoints)
  const W = 280, H = 70, padY = 8
  const pts = spendPoints.map((p, i) => [(i / (spendPoints.length - 1)) * W, H - padY - (p / max) * (H - padY * 2)])
  const d = `M ${pts[0][0]} ${pts[0][1]} ` + pts.slice(1).map(([x, y], i) => {
    const [px, py] = pts[i]
    const cx = (px + x) / 2
    return `C ${cx} ${py} ${cx} ${y} ${x} ${y}`
  }).join(" ")
  const dFill = d + ` L ${W} ${H} L 0 ${H} Z`
  const lastPt = pts[pts.length - 1]

  return (
    <div className="lg-glass" style={{ margin: "0 18px", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", fontWeight: 600 }}>Spent this week</div>
          <div className="lg-tnum" style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>RM {animTotal.toFixed(2)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <IconArrowDown size={11} stroke="#34d399" sw={2.5} />
            <span style={{ fontSize: 11, color: "#34d399", fontWeight: 600 }}>12% less than last week</span>
          </div>
        </div>
        <div style={{ padding: "5px 10px", borderRadius: 100, background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.15)", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>7 days</div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 12, display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sparkStroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#c4b5fd" />
          </linearGradient>
        </defs>
        <path d={dFill} fill="url(#sparkFill)" />
        <path d={d} fill="none" stroke="url(#sparkStroke)" strokeWidth="2.5" strokeLinecap="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 2.5} fill={i === pts.length - 1 ? "#fff" : "#a78bfa"} stroke={i === pts.length - 1 ? "#c4b5fd" : "none"} strokeWidth={i === pts.length - 1 ? 2 : 0} />
        ))}
        <circle cx={lastPt[0]} cy={lastPt[1]} r="10" fill="#fff" opacity="0.15" />
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "rgba(255,255,255,.4)", fontWeight: 600 }}>
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <span key={d}>{d}</span>)}
      </div>
    </div>
  )
}

/* ──────────────── Category breakdown ──────────────── */
function CategoryBreakdown() {
  const total = spendByCategory.reduce((s, d) => s + d.value, 0)
  const [prog, setProg] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 1100)
      setProg(1 - Math.pow(1 - t, 3))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="lg-glass" style={{ margin: "0 18px", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Spending by category</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>This month</div>
      </div>

      <div style={{ height: 9, borderRadius: 5, overflow: "hidden", display: "flex", background: "rgba(255,255,255,.06)" }}>
        {spendByCategory.map(d => (
          <div key={d.label} style={{
            width: `${(d.value / total) * 100 * prog}%`, height: "100%", background: d.color,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)",
          }} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
        {spendByCategory.map(d => {
          const pct = (d.value / total) * 100
          return (
            <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 3, background: d.color, boxShadow: `0 0 8px ${d.color}80` }} />
              <div style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{d.label}</div>
              <div className="lg-tnum" style={{ fontSize: 12, fontWeight: 600 }}>RM {d.value.toFixed(0)}</div>
              <div className="lg-tnum" style={{ fontSize: 10.5, color: "rgba(255,255,255,.45)", width: 32, textAlign: "right" }}>{pct.toFixed(0)}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ──────────────── Tx list ──────────────── */
function TxRow({ tx }) {
  const Ico = tx.icon
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: tx.iconBg, display: "grid", placeItems: "center",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.25), 0 4px 10px -4px rgba(0,0,0,.5)", position: "relative",
      }}>
        <Ico size={18} stroke="#fff" sw={2.2} />
        {tx.flagged && (
          <div style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: "50%", background: "#fbbf24", border: "1.5px solid #0a0a0f", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "#0a0a0f" }}>!</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 600,
            color: tx.blocked ? "rgba(255,255,255,.5)" : "#fff",
            textDecoration: tx.blocked ? "line-through" : "none",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{tx.merchant}</div>
          {tx.blocked && (
            <div style={{ fontSize: 9, fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,.15)", padding: "2px 6px", borderRadius: 4 }}>BLOCKED</div>
          )}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.sub}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="lg-tnum" style={{ fontSize: 13.5, fontWeight: 600, color: tx.amount > 0 ? "#34d399" : (tx.blocked ? "rgba(255,255,255,.4)" : "#fff"), textDecoration: tx.blocked ? "line-through" : "none" }}>
          {fmtRM(tx.amount, { sign: tx.amount > 0 })}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", marginTop: 2 }}>{tx.time}</div>
      </div>
    </div>
  )
}

/* ──────────────── Tab bar ──────────────── */
function TabBar({ onQR }) {
  const tabs = [
    { id: "home",  icon: IconHouse,  label: "Home",     active: true },
    { id: "cards", icon: IconCards,  label: "Cards" },
    { id: "stats", icon: IconChart,  label: "Insights" },
    { id: "me",    icon: IconUser,   label: "Profile" },
  ]
  return (
    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, width: "calc(min(100vw, 430px) - 28px)", zIndex: 30, display: "flex", alignItems: "center", gap: 6 }}>
      <div className="lg-glass-strong" style={{ flex: 1, padding: 6, borderRadius: 100, display: "flex", background: "rgba(20,20,28,.55)" }}>
        {tabs.map(t => {
          const Ico = t.icon
          return (
            <button key={t.id} className="lg-tap" style={{
              flex: 1, padding: "9px 6px", borderRadius: 100,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: t.active ? "rgba(255,255,255,.14)" : "transparent",
              border: t.active ? ".5px solid rgba(255,255,255,.22)" : ".5px solid transparent",
              color: "#fff",
            }}>
              <Ico size={19} stroke={t.active ? "#fff" : "rgba(255,255,255,.55)"} sw={t.active ? 2.2 : 1.9} />
              <div style={{ fontSize: 9.5, fontWeight: 600, color: t.active ? "#fff" : "rgba(255,255,255,.5)" }}>{t.label}</div>
            </button>
          )
        })}
      </div>
      <button onClick={onQR} className="lg-tap lg-glass-strong" style={{
        width: 54, height: 54, borderRadius: "50%", display: "grid", placeItems: "center",
        background: "linear-gradient(135deg,#a78bfa 0%, #ec4899 60%, #f59e0b 100%)",
        border: ".5px solid rgba(255,255,255,.3)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 8px 24px -4px rgba(236,72,153,.5)",
        color: "#fff",
      }}>
        <IconQR size={24} stroke="#fff" sw={2.2} />
      </button>
    </div>
  )
}

/* ──────────────── Main page ──────────────── */
export default function BankHome() {
  const navigate = useNavigate()
  const [activeIdx, setActiveIdx] = useState(0)
  const [hidden, setHidden] = useState(false)
  const totalNet = accounts.reduce((s, a) => s + a.balance, 0)
  const animNet = useAnimatedNumber(totalNet, 1500)

  return (
    <div className="lg-home">
      <div className="lg-aurora">
        <div className="lg-blob" />
        <div className="lg-blob b2" />
        <div className="lg-blob b3" />
      </div>

      <div className="lg-scroll">
        {/* Header */}
        <div style={{ padding: "14px 22px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "linear-gradient(135deg,#a78bfa,#ec4899)",
              display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, color: "#fff",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 6px 14px -4px rgba(167,139,250,.5)",
            }}>NR</div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", fontWeight: 500 }}>Selamat petang,</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: -1 }}>Nadia Rahman</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="lg-tap" onClick={() => setHidden(h => !h)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.15)", display: "grid", placeItems: "center", color: "#fff" }}>
              {hidden ? <IconEyeOff size={17} stroke="#fff" sw={2} /> : <IconEye size={17} stroke="#fff" sw={2} />}
            </button>
            <button className="lg-tap" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.15)", display: "grid", placeItems: "center", position: "relative", color: "#fff" }}>
              <IconBell size={17} stroke="#fff" sw={2} />
              <div style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: "50%", background: "#f43f5e", boxShadow: "0 0 6px #f43f5e" }} />
            </button>
          </div>
        </div>

        {/* Total balance */}
        <div style={{ padding: "0 22px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.55)", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>Total balance</div>
            <div style={{ fontSize: 10, padding: "2px 7px", borderRadius: 100, background: "rgba(52,211,153,.18)", color: "#6ee7b7", fontWeight: 700, border: ".5px solid rgba(52,211,153,.3)" }}>↑ RM 1,247 this month</div>
          </div>
          <div className="lg-tnum" style={{ fontSize: 34, fontWeight: 700, marginTop: 2, lineHeight: 1.05, letterSpacing: "-.03em" }}>
            {hidden ? "••••••••" : `RM ${animNet.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </div>

        {/* Card stack */}
        <CardStack accounts={accounts} activeIdx={activeIdx} setActiveIdx={setActiveIdx} hidden={hidden} />

        {/* Dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
          {accounts.map((a, i) => (
            <div key={a.id} style={{
              width: i === activeIdx ? 20 : 7, height: 7, borderRadius: 4,
              background: i === activeIdx ? "#fff" : "rgba(255,255,255,.4)",
              boxShadow: i === activeIdx ? "0 0 12px rgba(255,255,255,.5)" : "none",
              transition: "all .3s ease",
            }} />
          ))}
        </div>

        {/* Quick actions — wired to real routes */}
        <div style={{ display: "flex", gap: 12, padding: "18px 18px 0" }}>
          <QuickAction icon={IconSend}  label="Transfer"    tone="neutral" onClick={() => navigate("/transfer")} />
          <QuickAction icon={IconPhone} label="Verify Call" tone="red"     onClick={() => navigate("/voice")} />
        </div>

        {/* Shield card — opens scam safety check */}
        <div style={{ marginTop: 16 }}>
          <ShieldCard onOpen={() => navigate("/check")} />
        </div>

        {/* Activity header */}
        <div style={{ padding: "22px 22px 10px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.025em" }}>Activity</div>
          <button style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Filter</button>
        </div>

        {/* Tx list */}
        <div className="lg-glass" style={{ margin: "0 18px", padding: "6px 0" }}>
          <div style={{ padding: "8px 16px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Recent activity</div>
            <button style={{ fontSize: 11.5, color: "#a78bfa", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>See all</button>
          </div>
          {transactions.map((tx, i) => (
            <div key={tx.id}>
              <TxRow tx={tx} />
              {i < transactions.length - 1 && (
                <div style={{ height: 0.5, background: "rgba(255,255,255,.08)", margin: "0 16px 0 68px" }} />
              )}
            </div>
          ))}
        </div>

        {/* Spend chart */}
        <div style={{ marginTop: 14 }}>
          <SpendChart />
        </div>

        {/* Category */}
        <div style={{ marginTop: 12 }}>
          <CategoryBreakdown />
        </div>

        {/* Footer */}
        <div style={{ padding: "20px 22px 8px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <IconLock size={15} stroke="rgba(255,255,255,.4)" sw={1.8} />
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>Secured by JagaDuit Shield · Bank-grade encryption</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>PIDM member · BNM regulated</div>
        </div>
      </div>

      <TabBar onQR={() => navigate("/check")} />
    </div>
  )
}
