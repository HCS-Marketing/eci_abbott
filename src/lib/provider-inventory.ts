export interface ProviderInventorySourceRow {
  fecha: string
  retail: string
  titulo: string
  ean: string
  categoria: string
  disponibilidad: string
  disponible: boolean
  posicion?: number | null
}

export interface ProviderInventoryFilters {
  products?: string[]
  eans?: string[]
  category?: string
}

export interface ProviderInventoryRow {
  id: string
  estado: string
  producto: string
  ean: string
  categoria: string
  canal: string
  ultimo_visto: string | null
  stock_status: "in_stock" | "break"
  dias_disponibles_7d: number
  dias_observados_7d: number
  porcentaje_disponibilidad_7d: number
}

function inventoryKey(row: ProviderInventorySourceRow): string {
  return `${row.retail}|||${row.ean || row.titulo}`
}

function lastScrapeDatesByRetail(
  rows: ProviderInventorySourceRow[],
  effectiveDate: string
): Map<string, string[]> {
  const datesByRetail = new Map<string, Set<string>>()

  for (const row of rows) {
    if (row.fecha > effectiveDate) continue
    const dates = datesByRetail.get(row.retail) || new Set<string>()
    dates.add(row.fecha)
    datesByRetail.set(row.retail, dates)
  }

  return new Map(Array.from(datesByRetail.entries()).map(([retail, dates]) => [
    retail,
    Array.from(dates).sort((a, b) => b.localeCompare(a)).slice(0, 7),
  ]))
}

export function buildProviderInventoryRows(
  rows: ProviderInventorySourceRow[],
  effectiveDate: string,
  filters: ProviderInventoryFilters = {}
): ProviderInventoryRow[] {
  if (!effectiveDate) return []

  const products = new Set(filters.products || [])
  const eans = new Set(filters.eans || [])
  const category = String(filters.category || "").trim().toLowerCase()
  const scrapeDatesByRetail = lastScrapeDatesByRetail(rows, effectiveDate)
  const historyByProduct = new Map<string, ProviderInventorySourceRow[]>()
  const currentByProduct = new Map<string, ProviderInventorySourceRow>()

  for (const row of rows) {
    if (row.fecha > effectiveDate) continue
    if (products.size > 0 && !products.has(row.titulo)) continue
    if (eans.size > 0 && !eans.has(row.ean)) continue
    if (category && row.categoria.trim().toLowerCase() !== category) continue

    const key = inventoryKey(row)
    const history = historyByProduct.get(key) || []
    history.push(row)
    historyByProduct.set(key, history)

    if (row.fecha !== effectiveDate) continue
    const previous = currentByProduct.get(key)
    const shouldReplace = !previous ||
      (!row.disponible && previous.disponible) ||
      (row.disponible === previous.disponible && (row.posicion ?? 9999) < (previous.posicion ?? 9999))
    if (shouldReplace) currentByProduct.set(key, row)
  }

  return Array.from(currentByProduct.entries()).map(([key, current]) => {
    const history = historyByProduct.get(key) || []
    history.sort((a, b) => (
      a.fecha === b.fecha
        ? (a.posicion ?? 9999) - (b.posicion ?? 9999)
        : b.fecha.localeCompare(a.fecha)
    ))

    const lastAvailable = history.find(row => row.disponible)
    const scrapeDates = scrapeDatesByRetail.get(current.retail) || []
    const availabilityByDay = new Map(scrapeDates.map(date => [date, false]))

    for (const date of scrapeDates) {
      const observations = history.filter(row => row.fecha === date)
      if (observations.length > 0) {
        availabilityByDay.set(date, observations.every(row => row.disponible))
      }
    }

    const observedDays = scrapeDates.length
    const availableDays = Array.from(availabilityByDay.values()).filter(Boolean).length

    return {
      id: key,
      estado: current.disponibilidad || "NO DISPONIBLE",
      producto: current.titulo || current.ean,
      ean: current.ean || "",
      categoria: current.categoria || "",
      canal: current.retail || "",
      ultimo_visto: lastAvailable?.fecha || null,
      stock_status: current.disponible ? "in_stock" : "break",
      dias_disponibles_7d: availableDays,
      dias_observados_7d: observedDays,
      porcentaje_disponibilidad_7d: observedDays > 0
        ? Math.round((availableDays / observedDays) * 100)
        : 0,
    }
  })
}
