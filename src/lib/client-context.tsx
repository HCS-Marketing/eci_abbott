"use client"
import { createContext, useContext, useEffect, useState } from "react"

export interface ClientConfig {
  id: string
  name: string
  industry: string
  brand_color: string
}

interface ClientContextValue {
  client: ClientConfig | null
  loading: boolean
}

const ClientContext = createContext<ClientContextValue>({
  client: null,
  loading: true,
})

// Default client — will be replaced once DB is wired up
const DEFAULT_CLIENT: ClientConfig = {
  id: "default",
  name: "Newsan",
  industry: "Retail",
  brand_color: "#A427FF",
}

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<ClientConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setClient(DEFAULT_CLIENT)
    setLoading(false)
  }, [])

  return (
    <ClientContext.Provider value={{ client, loading }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClient() {
  return useContext(ClientContext)
}
