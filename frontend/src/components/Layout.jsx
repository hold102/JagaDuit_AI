import { Outlet } from "react-router-dom"

export default function Layout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", background: "#e9edf3" }}>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: "var(--ink-50)", display: "flex", flexDirection: "column", position: "relative" }}>
        <Outlet />
      </div>
    </div>
  )
}
