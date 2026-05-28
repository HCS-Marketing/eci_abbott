"use client"
import { useEffect, useState } from "react"
import { useClient } from "@/lib/client-context"

export interface MarketContext {
  clientBrand: string
  industry: string
  sellers: string[]
  categories: string[]
  channels: string[]
  colors: Record<string, string>
  loading: boolean
}

export function useMarket(): MarketContext {
  const { client } = useClient()
  const [sellers, setSellers]     = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [channels, setChannels]   = useState<string[]>([])
  const [colors, setColors]       = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [sRes, catRes, chanRes, sellersDataRes] = await Promise.all([
          fetch("/api/sos?action=sellers_list"),
          fetch("/api/sos?action=categories"),
          fetch("/api/sos?action=channels"),
          fetch("/api/sos?action=sellers"),
        ])
        const [s, cats, chans, sellersData] = await Promise.all([
          sRes.json(), catRes.json(), chanRes.json(), sellersDataRes.json(),
        ])
        if (cancelled) return
        setSellers(s as string[])
        setCategories(cats as string[])
        setChannels(chans as string[])
        const colorMap: Record<string, string> = {}
        if (Array.isArray(sellersData)) {
          for (const entry of sellersData as { seller: string; color: string }[]) {
            if (entry.seller && entry.color) colorMap[entry.seller] = entry.color
          }
        }
        setColors(colorMap)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return {
    clientBrand: client?.name || "Abbott",
    industry:    client?.industry || "Nutrición",
    sellers,
    categories,
    channels,
    colors,
    loading,
  }
}
