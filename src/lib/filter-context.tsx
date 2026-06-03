"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

interface FilterContextValue {
  country: string
  setCountry: (next: string) => void
  countries: string[]
  loadingCountries: boolean
}

const FilterContext = createContext<FilterContextValue>({
  country: "",
  setCountry: () => {},
  countries: [],
  loadingCountries: true,
})

const STORAGE_KEY = "abbott_eci_country"

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountryState] = useState("")
  const [countries, setCountries] = useState<string[]>([])
  const [loadingCountries, setLoadingCountries] = useState(true)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) setCountryState(saved)
  }, [])

  useEffect(() => {
    fetch("/api/sos?action=countries")
      .then(r => r.json())
      .then((data: string[]) => {
        if (!Array.isArray(data)) return
        setCountries(data)
        setCountryState(prev => (prev && data.includes(prev) ? prev : ""))
      })
      .finally(() => setLoadingCountries(false))
  }, [])

  const setCountry = (next: string) => {
    setCountryState(next)
    if (next) window.localStorage.setItem(STORAGE_KEY, next)
    else window.localStorage.removeItem(STORAGE_KEY)
  }

  const value = useMemo(
    () => ({ country, setCountry, countries, loadingCountries }),
    [country, countries, loadingCountries]
  )

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useGlobalFilters() {
  return useContext(FilterContext)
}
