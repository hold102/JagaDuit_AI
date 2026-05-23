import { Outlet } from "react-router-dom"

export default function Layout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", background: "#000" }}>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: "#05060a", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        <Outlet />
      </div>
    </div>
  )
}
