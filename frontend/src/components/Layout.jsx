import { Outlet } from "react-router-dom"

export default function Layout() {
  return (
    // Outer div centres the phone column on wide screens; inner div enforces 430px — iPhone 14 Pro width
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", background: "#000" }}>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: "#05060a", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", color: "#fff", fontFamily: "-apple-system, system-ui, sans-serif", WebkitFontSmoothing: "antialiased" }}>
        {/* Aurora background shared by all pages — sits behind Outlet content */}
        <div className="lg-aurora">
          <div className="lg-blob" />
          <div className="lg-blob b2" />
          <div className="lg-blob b3" />
        </div>
        {/* z-index 1 so page content renders above aurora blobs */}
        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
