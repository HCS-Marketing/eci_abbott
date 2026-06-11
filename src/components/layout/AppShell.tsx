"use client"
import { useState } from "react"
import { ClientProvider } from "@/lib/client-context"
import { FilterProvider } from "@/lib/filter-context"
import Sidebar from "@/components/layout/Sidebar"
import TopBar from "@/components/layout/Topbar"
import AIAdvisor from "@/components/ui/AIAdvisor"

function isAuthPath(path: string) {
  return (
    path === "/login" ||
    path.startsWith("/sign-in") ||
    path.startsWith("/sign-up")
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isAuth] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return isAuthPath(window.location.pathname)
    }
    return false
  })

  if (isAuth) return <>{children}</>

  return (
    <ClientProvider>
      <FilterProvider>
        <div className="flex min-h-screen bg-[#F5F6F6]">
          <Sidebar />
          <TopBar />
          <main className="flex-1 min-w-0 p-3 lg:p-6 pt-[68px] lg:pt-20">
            {children}
          </main>
          <AIAdvisor />
        </div>
      </FilterProvider>
    </ClientProvider>
  )
}
