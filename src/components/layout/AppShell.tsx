"use client"
import { usePathname } from "next/navigation"
import { ClientProvider } from "@/lib/client-context"
import Sidebar from "@/components/layout/Sidebar"
import TopBar from "@/components/layout/Topbar"
import AIAdvisor from "@/components/ui/AIAdvisor"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth =
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname?.startsWith("/login")

  if (isAuth) return <>{children}</>

  return (
    <ClientProvider>
      <div className="flex min-h-screen bg-[#F5F6F6]">
        <Sidebar />
        <TopBar />
        <main className="flex-1 min-w-0 p-3 lg:p-6 pt-[68px] lg:pt-20">
          {children}
        </main>
        <AIAdvisor />
      </div>
    </ClientProvider>
  )
}
