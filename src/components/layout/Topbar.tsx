"use client"
import { useClient } from "@/lib/client-context"

export default function TopBar() {
  const { client } = useClient()
  const brandColor = client?.brand_color || "#A427FF"

  return (
    <header
      className="fixed top-0 right-0 left-0 lg:left-[220px] z-40 h-14 flex items-center px-6 gap-4 border-b border-gray-100"
      style={{ backgroundColor: "rgba(245,246,246,0.92)", backdropFilter: "blur(8px)" }}
    >
      <div className="hidden lg:block flex-shrink-0" />

      <div className="ml-auto flex items-center gap-3 flex-shrink-0">
        {client && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200">
            <div
              className="w-5 h-5 rounded-lg flex items-center justify-center text-white text-[9px] font-black flex-shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-gray-700">{client.name}</span>
            {client.industry && (
              <span className="text-[10px] text-gray-400">{client.industry}</span>
            )}
          </div>
        )}

      </div>
    </header>
  )
}
