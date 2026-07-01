"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useMarket } from "@/lib/use-market"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import clsx from "clsx"
import { ExternalLink, Search, Download, FileText } from "lucide-react"
import { fmtPricePrefixed, getRetailColor } from "@/lib/format"
import { downloadCSV, exportPDF } from "@/lib/export"
import { useGlobalFilters } from "@/lib/filter-context"

// ─── TYPES ────────────────────────────────────────────────────
interface PriceRow {
  id: string; producto: string; marca: string; seller: string; fabricante: string
  country?: string
  plataforma: string; subcategoria: string
  precio_venta: number; precio: number; descuento: number
  cuotas_sin_interes: number | null
  tiene_cuotas_sin_interes: string | null
  detalle_cuotas: string | null
  oferta_relampago: string | null
  cupon: string | null
  full_ml: string | null
  envio: string; tienda_oficial: string; url_producto: string
}

// ─── HELPERS ──────────────────────────────────────────────────

type SortCol = "precio_venta" | "descuento" | "seller"

// ─── PAGE ─────────────────────────────────────────────────────
export default function PricingPage() {
  const market  = useMarket()
  const COLORS  = market.colors
  const SELLERS = market.sellers
  const { country } = useGlobalFilters()

  const [segmento,       setSegmento]       = useState("")
  const [mercado,        setMercado]        = useState("")
  const [channel,        setChannel]        = useState("")
  const [category,       setCategory]       = useState("")
  const [startDate,      setStartDate]      = useState("")
  const [endDate,        setEndDate]        = useState("")
  const [minDate,        setMinDate]        = useState("")
  const [maxDate,        setMaxDate]        = useState("")
  const [topN,           setTopN]           = useState(100)
  const [search,         setSearch]         = useState("")
  const [selectedSeller, setSelectedSeller] = useState("")
  const [sortBy,         setSortBy]         = useState<SortCol>("precio_venta")
  const [sortDir,        setSortDir]        = useState<"asc" | "desc">("asc")

  const [availableSegmentos,  setAvailableSegmentos]  = useState<string[]>([])
  const [availableMercados,   setAvailableMercados]   = useState<string[]>([])
  const [availableChannels,   setAvailableChannels]   = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [data,    setData]    = useState<PriceRow[]>([])
  const [loading, setLoading] = useState(false)

  // Seller dropdown
  const [sellerOpen,   setSellerOpen]   = useState(false)
  const [sellerSearch, setSellerSearch] = useState("")
  const sellerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) {
      if (sellerRef.current && !sellerRef.current.contains(e.target as Node)) {
        setSellerOpen(false); setSellerSearch("")
      }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // Mercado / Segmento solo aplican a MX
  useEffect(() => {
    if (country !== "MX") {
      setMercado("")
      setSegmento("")
    }
  }, [country])

  // Segmentos
  useEffect(() => {
    const p = new URLSearchParams({ action: "segmentos" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    if (mercado) p.set("mercado", mercado)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableSegmentos(d)
      if (segmento && !d.includes(segmento)) setSegmento("")
    })
  }, [channel, country, mercado])

  // Mercados
  useEffect(() => {
    const p = new URLSearchParams({ action: "mercados" })
    if (channel)  p.set("channel", channel)
    if (country)  p.set("country", country)
    if (segmento) p.set("segmento", segmento)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableMercados(d)
      if (mercado && !d.includes(mercado)) setMercado("")
    })
  }, [channel, country, segmento])

  // Fecha — canal-aware
  useEffect(() => {
    const p = new URLSearchParams({ action: "dates" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then((d: { min: string; max: string }) => {
        if (!d.max) return
        setMinDate(d.min); setMaxDate(d.max)
        setStartDate(prev => (!prev || prev < d.min || prev > d.max) ? d.max : prev)
        setEndDate(prev => (!prev || prev < d.min || prev > d.max) ? d.max : prev)
      })
  }, [channel, country])

  // Keep pricing in single-day mode.
  useEffect(() => {
    if (endDate && startDate !== endDate) setStartDate(endDate)
  }, [endDate, startDate])

  // Cascading channels
  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    if (country) p.set("country", country)
    if (endDate) { p.set("startDate", endDate); p.set("endDate", endDate) }
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableChannels(d)
      if (channel && !d.includes(channel)) setChannel("")
    })
  }, [country, endDate])

  // Cascading categories
  useEffect(() => {
    const p = new URLSearchParams({ action: "categories" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    if (endDate) { p.set("startDate", endDate); p.set("endDate", endDate) }
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableCategories(d)
      if (category && !d.includes(category)) setCategory("")
    })
  }, [channel, country, endDate])

  // Fetch pricing
  const fetchData = useCallback(() => {
    if (!endDate) return
    setLoading(true)
    const p = new URLSearchParams({ action: "pricing", limit: String(topN), date: endDate })
    if (channel)        p.set("channel",  channel)
    if (category)       p.set("category", category)
    if (country)        p.set("country",  country)
    if (selectedSeller) p.set("seller",   selectedSeller)
    if (segmento)       p.set("segmento", segmento)
    if (mercado)        p.set("mercado",  mercado)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [channel, category, country, endDate, topN, selectedSeller, segmento, mercado])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter + sort
  const filtered = data
    .filter(e =>
      !search ||
      e.producto?.toLowerCase().includes(search.toLowerCase()) ||
      e.fabricante?.toLowerCase().includes(search.toLowerCase()) ||
      e.marca?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let v = 0
      if      (sortBy === "precio_venta") v = (a.precio_venta || 0) - (b.precio_venta || 0)
      else if (sortBy === "descuento")    v = (a.descuento    || 0) - (b.descuento    || 0)
      else if (sortBy === "seller")       v = (a.fabricante || "").localeCompare(b.fabricante || "")
      return sortDir === "asc" ? v : -v
    })

  // KPIs
  const prices        = filtered.map(e => e.precio_venta).filter(p => p > 0)
  const minPrice      = prices.length ? Math.min(...prices) : 0
  const maxPrice      = prices.length ? Math.max(...prices) : 0
  const avgPrice      = prices.length ? Number((prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(1)) : 0
  const avgDiscount   = filtered.length ? Number((filtered.reduce((s, e) => s + (e.descuento || 0), 0) / filtered.length).toFixed(1)) : 0
  const uniqueSellers = new Set(filtered.map(e => e.fabricante)).size

  function toggleSort(col: SortCol) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortBy(col); setSortDir("asc") }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortBy !== col) return <span className="ml-0.5 text-gray-300">↕</span>
    return <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pricing Live"
        subtitle="Precios actuales por producto, seller y canal"
      />

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl">
        {/* Fecha unica */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fecha</span>
          <DateInput value={endDate} min={minDate} max={maxDate} onChange={setEndDate} />
        </div>
        {endDate === maxDate && maxDate && (
          <span className="text-[10px] text-green-600 font-semibold">✓ Última fecha</span>
        )}

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Retail */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Retail</span>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todos los canales</option>
            {availableChannels.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Mercado / Segmento — only Mexico */}
        {country === "MX" && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Mercado</span>
              <select value={mercado} onChange={e => { setMercado(e.target.value); setSegmento("") }}
                className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
                <option value="">Todos</option>
                {availableMercados.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Segmento</span>
              <select value={segmento} onChange={e => setSegmento(e.target.value)}
                className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
                <option value="">Todos</option>
                {availableSegmentos.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Fabricante */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fabricante</span>
          <div className="relative" ref={sellerRef}>
            <button onClick={() => { setSellerOpen(p => !p); setSellerSearch("") }}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg bg-white hover:border-gray-400 transition-colors min-w-[130px] justify-between">
              <span className="truncate">{selectedSeller || "Todos"}</span>
              <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {sellerOpen && (
              <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-56">
                <div className="p-2 border-b border-gray-100">
                  <input autoFocus type="text" placeholder="Buscar seller..." value={sellerSearch}
                    onChange={e => setSellerSearch(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-purple-400" />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {("todos".includes(sellerSearch.toLowerCase()) || sellerSearch === "") && (
                    <button onClick={() => { setSelectedSeller(""); setSellerOpen(false); setSellerSearch("") }}
                      className={clsx("w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100",
                        selectedSeller === "" ? "text-purple-700 font-semibold bg-purple-50" : "text-gray-500")}>
                      Todos los sellers
                    </button>
                  )}
                  {SELLERS.filter(s => s.toLowerCase().includes(sellerSearch.toLowerCase())).map(s => (
                    <button key={s} onClick={() => { setSelectedSeller(s); setSellerOpen(false); setSellerSearch("") }}
                      className={clsx("w-full text-left px-3 py-2 text-xs hover:bg-gray-50",
                        selectedSeller === s ? "text-purple-700 font-semibold bg-purple-50" : "text-gray-700")}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Categoría */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Categoría</span>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todas las categorías</option>
            {availableCategories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Límite */}
        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {[50, 100, 200].map(n => (
            <button key={n} onClick={() => setTopN(n)}
              className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
                topN === n ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
              {n}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => downloadCSV(data as unknown as Record<string, unknown>[], "pricing")}
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Precio mínimo",   value: fmtPricePrefixed(minPrice, country), color: "#16a34a" },
          { label: "Precio promedio", value: fmtPricePrefixed(avgPrice, country), color: "#7c3aed" },
          { label: "Precio máximo",   value: fmtPricePrefixed(maxPrice, country), color: "#dc2626" },
          { label: "Desc. promedio",  value: `${avgDiscount}%`,     color: avgDiscount > 15 ? "#16a34a" : "#6b7280" },
          { label: "Fabricantes",     value: String(uniqueSellers), color: "#d97706" },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-xl font-bold truncate" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabla ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400">
              {category || "Todas las categorías"} · {channel || "Todos los canales"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{filtered.length} registros</div>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
            <Search size={12} className="text-gray-400" />
            <input type="text" placeholder="Buscar producto, fabricante, marca..." value={search}
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
                  <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Producto</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => toggleSort("seller")}>
                    Fabricante <SortIcon col="seller" />
                  </th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => toggleSort("precio_venta")}>
                    Precio <SortIcon col="precio_venta" />
                  </th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => toggleSort("descuento")}>
                    Desc% <SortIcon col="descuento" />
                  </th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e, i) => {
                  const color    = COLORS[e.fabricante] || getRetailColor(e.fabricante)
                  const hasDiscount       = e.descuento && e.descuento > 0
                  const hasPrecioOriginal = e.precio && e.precio > e.precio_venta
                  const isOficial       = e.tienda_oficial?.toLowerCase() === "si"
                  const diffPct         = avgPrice > 0 ? Math.round(((e.precio_venta - avgPrice) / avgPrice) * 100) : 0

                  return (
                    <tr key={`${e.id}-${i}`} className="hover:bg-gray-50 transition-colors">
                      {/* Producto */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-start gap-1.5 flex-wrap mb-0.5">
                          <span className="font-medium text-gray-800 leading-snug">{e.producto}</span>
                          {isOficial && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">Oficial</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {e.marca && <span className="text-[10px] text-gray-400">{e.marca}</span>}
                          {e.subcategoria && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">· {e.subcategoria}</span>}
                        </div>
                      </td>

                      {/* Seller */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-medium" style={{ color }}>{e.fabricante}</span>
                        </span>
                      </td>

                      {/* Canal */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.plataforma}</span>
                      </td>

                      {/* Precio */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="font-black text-gray-900 font-mono">{fmtPricePrefixed(e.precio_venta, e.country || country)}</div>
                        {hasPrecioOriginal && (
                          <div className="text-[10px] text-gray-400 line-through font-mono">{fmtPricePrefixed(e.precio, e.country || country)}</div>
                        )}
                        {diffPct !== 0 && (
                          <div className={clsx("text-[9px] font-bold", diffPct < 0 ? "text-green-600" : "text-red-500")}>
                            {diffPct > 0 ? "+" : ""}{diffPct}% vs prom
                          </div>
                        )}
                      </td>

                      {/* Descuento */}
                      <td className="px-3 py-3 text-right">
                        {hasDiscount ? (
                          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
                            -{e.descuento}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Link */}
                      <td className="px-3 py-3 text-center">
                        {e.url_producto && (
                          <a href={e.url_producto} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1 text-[9px] text-gray-400 hover:text-purple-600 transition-colors bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full">
                            <ExternalLink size={8} />ver
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
