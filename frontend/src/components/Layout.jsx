import { Outlet, Link, useLocation } from "react-router-dom"
import { ShieldCheckIcon } from "./icons"

export default function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/transfer" className="flex items-center gap-2">
            <ShieldCheckIcon className="w-7 h-7 text-brand-600" />
            <span className="font-bold text-lg text-gray-900">JagaDuit AI</span>
          </Link>
          <span className="text-xs text-gray-400">Mock Banking Demo</span>
        </div>
      </header>

      {/* Main content — phone-width frame */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
