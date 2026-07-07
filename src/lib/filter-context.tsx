"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

interface FilterContextValue {
  country: string
  setCountry: (next: string) => void
  countries: string[]
  loadingCountries: boolean
}

const FilterContext = createContext<FilterContextValue>({
  country: "MX",
  setCountry: () => {},
  countries: [],
  loadingCountries: true,
})

const STORAGE_KEY = "abbott_eci_country"
const DEFAULT_COUNTRIES = ["MX", "CO", "PE"] as const
const DEFAULT_COUNTRY = "MX"

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountryState] = useState(DEFAULT_COUNTRY)
  const [countries, setCountries] = useState<string[]>([...DEFAULT_COUNTRIES])
  const [loadingCountries, setLoadingCountries] = useState(true)
  const [countryLock, setCountryLock] = useState<string[] | null>(null)

  // 1. Fetch the user's country lock from the auth token
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then((d: { countryLock?: string[] | null }) => {
        setCountryLock(d.countryLock ?? null)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && DEFAULT_COUNTRIES.includes(saved as "MX" | "CO" | "PE")) {
      setCountryState(saved)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/sos?action=countries")
      .then(r => r.json())
      .then((data: unknown) => {
        if (cancelled) return
        const apiCountries = Array.isArray(data) ? (data as string[]).filter(Boolean) : []
        const allCountries = Array.from(new Set([...DEFAULT_COUNTRIES, ...apiCountries]))

        // Apply lock strictly: locked users must only see their allowed country.
        const effectiveList = countryLock && countryLock.length > 0
          ? countryLock
          : allCountries

        setCountries(effectiveList)
        setCountryState(prev => {
          // If user is locked, always force to the locked country
          if (countryLock && countryLock.length > 0) {
            const locked = countryLock[0]
            try { window.localStorage.setItem(STORAGE_KEY, locked) } catch {}
            return locked
          }
          if (prev && effectiveList.includes(prev)) return prev
          const next = effectiveList.includes(DEFAULT_COUNTRY) ? DEFAULT_COUNTRY : effectiveList[0]
          try { window.localStorage.setItem(STORAGE_KEY, next) } catch {}
          return next
        })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCountries(false)
      })
    return () => { cancelled = true }
  }, [countryLock]) // re-run when lock is known

  const setCountry = (next: string) => {
    // Ignore if user has a country lock
    if (countryLock && countryLock.length > 0) return
    if (!next) return
    setCountryState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
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
