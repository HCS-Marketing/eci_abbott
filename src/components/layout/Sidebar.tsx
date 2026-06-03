"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import {
  Search, ChevronLeft, ChevronRight, ListOrdered,
  Tag, LogOut, ScanSearch,
} from "lucide-react"
import { useClient } from "@/lib/client-context"
import { useGlobalFilters } from "@/lib/filter-context"

const NAV = [
  { href: "/ecommerce-index", label: "SOS",               icon: Search       },
  { href: "/search",          label: "Search",            icon: ScanSearch   },
  { href: "/ranking",         label: "Ranking",           icon: ListOrdered  },
]

function SOSBrandmark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 128" fill="none">
      <circle cx="107" cy="20.24" r="13.3" fill="#A427FF"/>
      <path d="M86.9686 43.9048C86.9505 43.8867 86.9346 43.8663 86.9188 43.8482L74.865 83.1451C74.7316 83.7063 74.5892 84.2674 74.4173 84.8264C72.405 91.3887 67.9597 96.772 61.9 99.9876C55.8404 103.203 48.8921 103.864 42.3372 101.85C28.8025 97.6908 21.1713 83.2899 25.3272 69.7444C28.4 59.7312 37.0644 52.9472 46.8436 51.7705L41.9235 67.8119C39.9631 74.2022 43.5514 80.975 49.9367 82.9369C51.1193 83.3012 52.3154 83.4732 53.4911 83.4732C55.5577 83.4732 57.561 82.9301 59.3269 81.9571C61.9792 80.493 64.091 78.0446 65.0497 74.9173L69.4294 60.6364L74.1618 45.2082C75.9594 39.3496 73.0924 33.1743 67.6839 30.6738C67.2904 30.4928 66.8857 30.3298 66.4674 30.1895C66.3611 30.1533 66.2571 30.1171 66.1486 30.0832C65.9677 30.0266 65.7868 29.9768 65.6059 29.9316C65.2419 29.8094 64.8756 29.6917 64.5048 29.5786C38.2221 21.4979 10.2707 36.331 2.20092 62.6367C-5.86885 88.9425 8.95023 116.916 35.2375 124.992C40.0716 126.477 45.0166 127.214 49.9344 127.214C57.968 127.214 65.9338 125.25 73.2325 121.376C83.95 115.69 92.0673 106.507 96.3837 95.2853L96.5035 95.3215L97.5436 91.9318L112.021 44.7352L88.895 37.6298L86.9686 43.907V43.9048Z" fill="#A427FF"/>
    </svg>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { client } = useClient()
  const { country, setCountry, countries } = useGlobalFilters()
  const brandColor = client?.brand_color || "#A427FF"
  const [expanded, setExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const router = useRouter()

  if (
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname?.startsWith("/login")
  ) return null

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  const W = expanded ? "220px" : "60px"
  const countryLabel = (code: string) =>
    code === "MX" ? "Mexico" : code === "CO" ? "Colombia" : code === "PE" ? "Peru" : code

  return (
    <>
      {/* DESKTOP */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-all duration-200"
        style={{ backgroundColor: "#0D1117", width: W }}
      >
        {/* Logo + toggle */}
        <div
          className="flex items-center gap-3 px-3 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Link href="/ecommerce-index" className="flex-shrink-0">
            <SOSBrandmark size={28} />
          </Link>
          {expanded && (
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white truncate">Share of Shelf</div>
              {client?.name && (
                <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {client.name}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {expanded && (
            <div className="px-2 mb-2">
              <div className="text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                Pais
              </div>
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 text-[11px] text-white px-2 py-1.5 outline-none"
              >
                {countries.map(c => (
                  <option key={c} value={c} className="text-black">{countryLabel(c)}</option>
                ))}
              </select>
            </div>
          )}

          {expanded && (
            <div
              className="text-[9px] uppercase tracking-widest font-bold px-2 py-1.5"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              Módulos
            </div>
          )}
          {NAV.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl mb-0.5 transition-all duration-150"
                style={isActive ? { backgroundColor: brandColor, color: "#fff" } : { color: "rgba(255,255,255,0.5)" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)" }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent" }}
              >
                <Icon size={15} className="flex-shrink-0" />
                {expanded && <span className="text-[13px] font-light truncate">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div
          className="flex flex-col gap-1 py-3 px-2 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-2 py-2 rounded-xl transition-all duration-150 w-full"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.15)"
              e.currentTarget.style.color = "#f87171"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.color = "rgba(255,255,255,0.4)"
            }}
          >
            <LogOut size={15} className="flex-shrink-0" />
            {expanded && <span className="text-[12px] font-light">Cerrar sesión</span>}
          </button>

          {expanded && client && (
            <div className="px-2 pt-1 min-w-0">
              <div className="text-[11px] font-semibold text-white truncate">{client.name}</div>
              <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{client.industry}</div>
            </div>
          )}
        </div>
      </aside>

      {/* Desktop offset */}
      <div className="hidden lg:block flex-shrink-0 transition-all duration-200" style={{ width: W }} />

      {/* MOBILE header */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-50 h-[56px] flex items-center px-4 gap-3"
        style={{ backgroundColor: "#0D1117" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect width="18" height="2" rx="1" fill="white"/>
            <rect y="6" width="18" height="2" rx="1" fill="white"/>
            <rect y="12" width="12" height="2" rx="1" fill="white"/>
          </svg>
        </button>
        <Link href="/ecommerce-index" className="flex items-center gap-2 flex-1">
          <SOSBrandmark size={24} />
          <span className="text-sm font-bold text-white">Share of Shelf</span>
        </Link>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-[60]" onClick={() => setMobileOpen(false)} />
      )}

      <div
        className={`lg:hidden fixed left-0 top-0 bottom-0 w-72 z-[70] flex flex-col transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: "#0D1117" }}
      >
        <div
          className="flex items-center justify-between px-4 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <SOSBrandmark size={28} />
            <span className="text-sm font-bold text-white">Share of Shelf</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
              Pais
            </div>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 text-xs text-white px-2.5 py-2 outline-none"
            >
              <option value="" className="text-black">Todos</option>
              {countries.map(c => (
                <option key={c} value={c} className="text-black">{countryLabel(c)}</option>
              ))}
            </select>
          </div>

          {NAV.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors mb-0.5"
                style={isActive ? { backgroundColor: brandColor, color: "#fff" } : { color: "rgba(255,255,255,0.7)" }}
              >
                <Icon size={15} />
                <span className="text-sm font-light">{label}</span>
              </Link>
            )
          })}
        </nav>

      </div>
    </>
  )
}
