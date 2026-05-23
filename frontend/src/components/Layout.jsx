import { Outlet } from "react-router-dom"

export default function Layout() {
  return (
    // Outer div centres the phone column on wide screens; inner div enforces 430px — iPhone 14 Pro width
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", background: "#000" }}>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: "#05060a", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        <Outlet />
      </div>
    </div>
  )
}
