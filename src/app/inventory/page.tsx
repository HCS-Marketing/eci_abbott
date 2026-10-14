"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useMarket } from "@/lib/use-market"
import { useGlobalFilters } from "@/lib/filter-context"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import ProductMultiSelect from "@/components/ui/ProductMultiSelect"
import fallbackRows from "@/data/mx-provider-rows.json"
import clsx from "clsx"
import { Search, AlertTriangle, Download, FileText } from "lucide-react"
import { downloadCSV, exportPDF } from "@/lib/export"

// ─── TYPES ──────────────────────────────────────────────────────────
interface InventoryRow {
  id: string
  estado: "DISPONIBLE" | "NO DISPONIBLE" | string
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

interface FallbackInventoryRow {
  fecha: string
  retail: string
  titulo: string
  disponibilidad: string
  EAN?: string
  ean?: string
  categoria?: string
}

function normalizeInventoryChannel(value: string): string {
  const normalized = String(value || "").trim().toUpperCase()
  if (!normalized) return ""
  if (normalized === "ML" || normalized.includes("MERCADO")) return "MERCADO LIBRE"
  if (normalized.includes("AMAZON")) return "AMAZON"
  if (normalized === "SAMS" || normalized.includes("SAM'S") || normalized.includes("SAMS CLUB")) return "SAMS CLUB"
  if (normalized === "HEB" || normalized.includes("H-E-B")) return "HEB"
  return normalized
}

function isAvailable(value: string): boolean {
  return !String(value || "").toUpperCase().includes("NO")
}

function buildLocalInventoryRows(
  rows: FallbackInventoryRow[],
  effectiveDate: string,
  channel: string,
  category: string,
  selectedEans: string[]
): InventoryRow[] {
  if (!effectiveDate) return []

  const windowStartDate = new Date(`${effectiveDate}T00:00:00Z`)
  windowStartDate.setUTCDate(windowStartDate.getUTCDate() - 6)
  const windowStart = windowStartDate.toISOString().slice(0, 10)
  const scoped = rows.filter(row => {
    const ean = String(row.EAN || row.ean || "").trim()
    return row.fecha <= effectiveDate &&
      (!channel || normalizeInventoryChannel(row.retail) === channel) &&
      (!category || String(row.categoria || "") === category) &&
      (selectedEans.length === 0 || selectedEans.includes(ean))
  })
  const currentByProduct = new Map<string, FallbackInventoryRow>()

  for (const row of scoped) {
    if (row.fecha !== effectiveDate) continue
    const ean = String(row.EAN || row.ean || "").trim()
    const key = `${row.retail}|||${ean || row.titulo}`
    const previous = currentByProduct.get(key)
    if (!previous || (!isAvailable(row.disponibilidad) && isAvailable(previous.disponibilidad))) {
      currentByProduct.set(key, row)
    }
  }

  return Array.from(currentByProduct.entries()).map(([key, current]) => {
    const history = scoped.filter(row => {
      const ean = String(row.EAN || row.ean || "").trim()
      return `${row.retail}|||${ean || row.titulo}` === key
    })
    const lastAvailable = history
      .filter(row => isAvailable(row.disponibilidad))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    const availabilityByDay = new Map<string, boolean>()
    for (const row of history.filter(item => item.fecha >= windowStart)) {
      const previous = availabilityByDay.get(row.fecha)
      const available = isAvailable(row.disponibilidad)
      availabilityByDay.set(row.fecha, previous === undefined ? available : previous && available)
    }
    const observedDays = Array.from(availabilityByDay.values())
    const availableDays = observedDays.filter(Boolean).length

    return {
      id: key,
      estado: current.disponibilidad || "NO DISPONIBLE",
      producto: current.titulo || "",
      ean: String(current.EAN || current.ean || "").trim(),
      categoria: String(current.categoria || "").trim(),
      canal: current.retail || "",
      ultimo_visto: lastAvailable?.fecha || null,
      stock_status: isAvailable(current.disponibilidad) ? "in_stock" : "break",
      dias_disponibles_7d: availableDays,
      dias_observados_7d: observedDays.length,
      porcentaje_disponibilidad_7d: observedDays.length > 0 ? Math.round((availableDays / observedDays.length) * 100) : 0,
    }
  })
}

function AvailabilityBar({ row }: { row: InventoryRow }) {
  const percentage = Math.max(0, Math.min(100, row.porcentaje_disponibilidad_7d))
  const color = percentage >= 80 ? "#16a34a" : percentage >= 50 ? "#d97706" : "#dc2626"
  const detail = row.dias_observados_7d === 0
    ? "Sin observaciones"
    : row.dias_disponibles_7d === row.dias_observados_7d
      ? `${percentage}% (estuvo los ${row.dias_observados_7d} días observados)`
      : `${percentage}% (estuvo ${row.dias_disponibles_7d} de ${row.dias_observados_7d} días observados)`

  return (
    <div className="min-w-48">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
      <div className="mt-1 text-[10px] font-medium text-gray-600 whitespace-nowrap">{detail}</div>
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────
export default function InventoryPage() {
  useMarket()
  const { country } = useGlobalFilters()

  const [channel,    setChannel]    = useState("")
  const [category,   setCategory]   = useState("")
  const [date,      setDate]      = useState("")
  const [minDate,    setMinDate]    = useState("")
  const [maxDate,    setMaxDate]    = useState("")
  const [search,     setSearch]     = useState("")
  const [showOnlyUnavailable, setShowOnlyUnavailable] = useState(false)

  const [availableEans, setAvailableEans] = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [availableChannels, setAvailableChannels] = useState<string[]>([])
  const [selectedEans, setSelectedEans] = useState<string[]>([])
  const [data,    setData]    = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const isColombia = country === "CO"
  const useLocalFallback = country === "MX"
  const showCategoryFilter = availableCategories.length > 0
  const providerBasePath = isColombia ? "base_prov_co" : "base_prov"
  const providerFolders = isColombia
    ? ["base_prov_co/cruz_verde", "base_prov_co/farmatodo", "base_prov_co/larebaja", "base_prov_co/rappi", "base_prov_co/unidroga"]
    : ["base_prov/amz", "base_prov/ml", "base_prov/heb", "base_prov/sams"]

  const fallbackDateBounds = useMemo(() => {
    const typed = fallbackRows as Array<{ fecha?: string; ean?: string; categoria?: string; titulo?: string }>
    const dates = Array.from(new Set(typed.map(r => r.fecha).filter(Boolean) as string[])).sort()
    return {
      min: dates[0] || "",
      max: dates[dates.length - 1] || "",
    }
  }, [])

  useEffect(() => {
    setChannel("")
    setCategory("")
    setDate("")
    setMinDate("")
    setMaxDate("")
    setAvailableChannels([])
    setAvailableCategories([])
    setAvailableEans([])
    setSelectedEans([])
    setData([])
  }, [country])

  useEffect(() => {
    if (useLocalFallback && !date && fallbackDateBounds.max) {
      setMinDate(fallbackDateBounds.min)
      setMaxDate(fallbackDateBounds.max)
      setDate(fallbackDateBounds.max)
    }
  }, [date, fallbackDateBounds, useLocalFallback])

  // Countries handled by global filter context
  // Fecha canal-aware
  useEffect(() => {
    const p = new URLSearchParams({ action: "dates" })
    p.set("source", "provider")
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then((d: { min: string; max: string }) => {
        if (!d.max) return
        setMinDate(d.min); setMaxDate(d.max)
        setDate(d.max)
      })
  }, [channel, country])

  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    p.set("source", "provider")
    if (country) p.set("country", country)
    if (date) p.set("endDate", date)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then((d: string[]) => {
        const channels = Array.isArray(d) ? d : []
        setAvailableChannels(channels)
        if (channel && !channels.includes(channel)) setChannel("")
      })
      .catch(() => setAvailableChannels([]))
  }, [channel, country, date])

  useEffect(() => {
    const effectiveDate = date || (useLocalFallback ? fallbackDateBounds.max : "")
    const local = useLocalFallback ? Array.from(new Set((fallbackRows as Array<{ fecha: string; retail: string; categoria?: string; EAN?: string; ean?: string }>)
      .filter(r => (!effectiveDate || r.fecha <= effectiveDate) && (!channel || normalizeInventoryChannel(r.retail) === channel) && (!category || String(r.categoria || "") === category))
      .map(r => String(r.EAN || r.ean || "").trim())
      .filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")) : []

    const p = new URLSearchParams({ action: "eans" })
    if (channel) p.set("channel", channel)
    if (category) p.set("category", category)
    if (effectiveDate) p.set("date", effectiveDate)
    if (country) p.set("country", country)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then((d: string[]) => {
        const merged = Array.from(new Set([...(Array.isArray(d) ? d : []), ...local])).sort((a, b) => a.localeCompare(b, "es"))
        setAvailableEans(merged)
        setSelectedEans(prev => prev.filter(item => merged.includes(item)))
      })
      .catch(() => {
        setAvailableEans(local)
        setSelectedEans(prev => prev.filter(item => local.includes(item)))
      })
  }, [date, channel, category, country, fallbackDateBounds.max, useLocalFallback])

  useEffect(() => {
    const effectiveDate = date || (useLocalFallback ? fallbackDateBounds.max : "")
    const local = useLocalFallback ? Array.from(new Set((fallbackRows as Array<{ fecha: string; retail: string; categoria?: string }>)
      .filter(r => (!effectiveDate || r.fecha === effectiveDate) && (!channel || normalizeInventoryChannel(r.retail) === channel))
      .map(r => String(r.categoria || "").trim())
      .filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")) : []

    const p = new URLSearchParams({ action: "categories" })
    if (channel) p.set("channel", channel)
    if (effectiveDate) p.set("date", effectiveDate)
    if (selectedEans.length) p.set("eans", selectedEans.map(v => encodeURIComponent(v)).join(","))
    if (country) p.set("country", country)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then((d: string[]) => {
        const merged = Array.from(new Set([...(Array.isArray(d) ? d : []), ...local])).sort((a, b) => a.localeCompare(b, "es"))
        setAvailableCategories(merged)
        if (category && !merged.includes(category)) setCategory("")
      })
      .catch(() => {
        setAvailableCategories(local)
        if (category && !local.includes(category)) setCategory("")
      })
  }, [date, channel, category, country, fallbackDateBounds.max, selectedEans, useLocalFallback])

  const fetchData = useCallback(() => {
    setLoading(true)
    const effectiveDate = date || (useLocalFallback ? fallbackDateBounds.max : "")
    const p = new URLSearchParams({
      action: "inventory", date: effectiveDate,
      limit: "5000",
    })
    p.set("source", "provider")
    if (channel)    p.set("channel",    channel)
    if (category)   p.set("category",   category)
    if (selectedEans.length) p.set("eans", selectedEans.map(v => encodeURIComponent(v)).join(","))
    if (country)    p.set("country",    country)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setData(d)
          return
        }
        setData(useLocalFallback ? buildLocalInventoryRows(fallbackRows as FallbackInventoryRow[], effectiveDate, channel, category, selectedEans) : [])
      })
      .catch(() => {
        setData(useLocalFallback ? buildLocalInventoryRows(fallbackRows as FallbackInventoryRow[], effectiveDate, channel, category, selectedEans) : [])
      })
      .finally(() => setLoading(false))
  }, [channel, category, country, date, fallbackDateBounds.max, selectedEans, useLocalFallback])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() =>
    data.filter(e =>
      (!showCategoryFilter || !category || e.categoria === category) &&
      (!showOnlyUnavailable || e.stock_status === "break") &&
      (selectedEans.length === 0 || selectedEans.includes(e.ean)) && (
        !search ||
        e.producto?.toLowerCase().includes(search.toLowerCase()) ||
        e.ean?.toLowerCase().includes(search.toLowerCase()) ||
        e.categoria?.toLowerCase().includes(search.toLowerCase()) ||
        e.canal?.toLowerCase().includes(search.toLowerCase()) ||
        e.estado?.toLowerCase().includes(search.toLowerCase())
      )
    )
  , [data, search, selectedEans, category, showOnlyUnavailable, showCategoryFilter])

  // KPIs
  const inStock = data.filter(e => e.stock_status === "in_stock").length
  const breaks = data.filter(e => e.stock_status === "break").length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventario"
        subtitle={`Estado diario de productos desde archivos ${providerBasePath}`}
      />

      {/* ── Nota lógica ──────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
        <span className="font-semibold">Lógica de inventario:</span> se unifican todos los Excel diarios de {providerFolders.map((folder, idx) => (
          <span key={folder}><span className="font-semibold">{folder}</span>{idx < providerFolders.length - 1 ? ", " : ""}</span>
        ))}. El estado corresponde al día seleccionado, <span className="font-semibold">Último visto</span> muestra la fecha más reciente con disponibilidad y el porcentaje usa las observaciones de los últimos 7 días calendario.
      </div>

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl flex">
        {/* Fecha */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fecha</span>
          <DateInput value={date} min={minDate} max={maxDate} onChange={setDate} />
        </div>
        {maxDate && (
          <span className="text-[10px] text-green-600 font-semibold">Última actualización BD: {maxDate}</span>
        )}

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Retail */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Retail</span>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todos</option>
            {availableChannels.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {showCategoryFilter && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Categoría</span>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
              <option value="">Todas</option>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowOnlyUnavailable(prev => !prev)}
          className={clsx(
            "text-xs px-3 py-1.5 rounded-lg border transition-colors",
            showOnlyUnavailable
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          )}
        >
          Solo no disponibles
        </button>

        <ProductMultiSelect
          options={availableEans}
          selected={selectedEans}
          onChange={setSelectedEans}
          label="EAN"
          allLabel="Todos los EAN"
          searchPlaceholder="Buscar EAN..."
        />

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => downloadCSV(data as unknown as Record<string, unknown>[], "inventory")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 transition-colors" title="Descargar CSV">
            <Download size={12} /><span>CSV</span>
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 transition-colors" title="Exportar PDF">
            <FileText size={12} /><span>PDF</span>
          </button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "Artículos disponibles", value: String(inStock), color: "#16a34a", sub: date || "día seleccionado" },
          { label: "Rotura de stock", value: String(breaks), color: breaks > 0 ? "#dc2626" : "#6b7280", sub: date || "día seleccionado" },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabla ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400">
              {channel || "Todos"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{filtered.length} productos</div>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
            <Search size={12} className="text-gray-400" />
            <input type="text" placeholder="Buscar producto, canal o estado..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-400 w-52" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm">Sin resultados para los filtros seleccionados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Estado</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Producto</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">EAN</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Ultimo visto</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">% Disp 7 días</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e, i) => (
                  <tr key={`${e.id}-${i}`}
                    className={clsx("transition-colors",
                      e.stock_status === "break"
                        ? "bg-red-50/60 hover:bg-red-50"
                        : "bg-green-50/30 hover:bg-green-50/50"
                    )}>

                    {/* Estado */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {e.estado === "NO DISPONIBLE" ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit text-red-700 bg-red-100 border-red-200">
                          <AlertTriangle size={9} />No disponible
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full w-fit">
                          Disponible
                        </span>
                      )}
                    </td>

                    {/* Producto */}
                    <td className="px-3 py-2.5 max-w-xs">
                      <div className="font-medium text-gray-800 leading-snug truncate">{e.producto}</div>
                      {e.categoria && (
                        <div className="text-[10px] text-gray-500 mt-0.5">{e.categoria}</div>
                      )}
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-gray-700">
                      {e.ean || "-"}
                    </td>

                    {/* Canal */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.canal}</span>
                    </td>

                    {/* Ultimo visto */}
                    <td className="px-3 py-2.5 text-center">
                      {e.ultimo_visto ? (
                        <span className="text-[10px] font-medium text-gray-700">{e.ultimo_visto}</span>
                      ) : (
                        <span className="text-[10px] font-medium text-gray-400">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      <AvailabilityBar row={e} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

