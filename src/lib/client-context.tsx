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

// Default client — Abbott
const DEFAULT_CLIENT: ClientConfig = {
  id: "default",
  name: "Abbott",
  industry: "Nutrición",
  brand_color: "#003DA5",
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
