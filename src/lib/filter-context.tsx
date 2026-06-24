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
    if (saved) setCountryState(saved)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/sos?action=countries")
      .then(r => r.json())
      .then((data: unknown) => {
        if (cancelled) return
        if (!Array.isArray(data) || data.length === 0) return
        const allCountries = (data as string[]).filter(Boolean)
        if (allCountries.length === 0) return

        // Apply lock: if the user has a country restriction, filter the list
        const list = countryLock
          ? allCountries.filter(c => countryLock.includes(c))
          : allCountries
        const effectiveList = list.length > 0 ? list : allCountries

        setCountries(effectiveList)
        setCountryState(prev => {
          // If user is locked, always force to the locked country
          if (countryLock && countryLock.length > 0) {
            const locked = countryLock[0]
            try { window.localStorage.setItem(STORAGE_KEY, locked) } catch {}
            return locked
          }
          if (prev && effectiveList.includes(prev)) return prev
          if (prev) return prev
          const next = effectiveList[0]
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
