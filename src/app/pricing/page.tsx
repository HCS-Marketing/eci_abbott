"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useMarket } from "@/lib/use-market"
import PageHeader from "@/components/ui/PageHeader"
import clsx from "clsx"
import { ExternalLink, Search, Truck } from "lucide-react"

// ─── TYPES ────────────────────────────────────────────────────
interface PriceRow {
  id: string; producto: string; marca: string; seller: string
  plataforma: string; subcategoria: string
  precio_venta: number; precio: number; descuento: number
  cuotas_sin_interes: number | null; envio: string
  tienda_oficial: string; url_producto: string
}

// ─── HELPERS ──────────────────────────────────────────────────
function fmtARS(n: number) {
  if (!n || n === 0) return "—"
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

type SortCol = "precio_venta" | "descuento" | "seller"

// ─── PAGE ─────────────────────────────────────────────────────
export default function PricingPage() {
  const market  = useMarket()
  const COLORS  = market.colors
  const SELLERS = market.sellers

  const [channel,        setChannel]        = useState("")
  const [category,       setCategory]       = useState("")
  const [date,           setDate]           = useState("")
  const [minDate,        setMinDate]        = useState("")
  const [maxDate,        setMaxDate]        = useState("")
  const [topN,           setTopN]           = useState(100)
  const [search,         setSearch]         = useState("")
  const [selectedSeller, setSelectedSeller] = useState("")
  const [sortBy,         setSortBy]         = useState<SortCol>("precio_venta")
  const [sortDir,        setSortDir]        = useState<"asc" | "desc">("asc")

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

  // Fecha — canal-aware
  useEffect(() => {
    const p = new URLSearchParams({ action: "dates" })
    if (channel) p.set("channel", channel)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then((d: { min: string; max: string }) => {
        if (!d.max) return
        setMinDate(d.min); setMaxDate(d.max)
        setDate(prev => (!prev || prev > d.max) ? d.max : prev)
      })
  }, [channel])

  // Cascading channels
  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    if (category) p.set("category", category)
    if (date) { p.set("startDate", date); p.set("endDate", date) }
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableChannels(d)
      if (channel && !d.includes(channel)) setChannel("")
    })
  }, [category, date])

  // Cascading categories
  useEffect(() => {
    const p = new URLSearchParams({ action: "categories" })
    if (channel) p.set("channel", channel)
    if (date) { p.set("startDate", date); p.set("endDate", date) }
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableCategories(d)
      if (category && !d.includes(category)) setCategory("")
    })
  }, [channel, date])

  // Fetch pricing
  const fetchData = useCallback(() => {
    if (!date) return
    setLoading(true)
    const p = new URLSearchParams({ action: "pricing", limit: String(topN), date })
    if (channel)        p.set("channel",  channel)
    if (category)       p.set("category", category)
    if (selectedSeller) p.set("seller",   selectedSeller)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [channel, category, date, topN, selectedSeller])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter + sort
  const filtered = data
    .filter(e =>
      !search ||
      e.producto?.toLowerCase().includes(search.toLowerCase()) ||
      e.seller?.toLowerCase().includes(search.toLowerCase()) ||
      e.marca?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let v = 0
      if      (sortBy === "precio_venta") v = (a.precio_venta || 0) - (b.precio_venta || 0)
      else if (sortBy === "descuento")    v = (a.descuento    || 0) - (b.descuento    || 0)
      else if (sortBy === "seller")       v = (a.seller || "").localeCompare(b.seller || "")
      return sortDir === "asc" ? v : -v
    })

  // KPIs
  const prices        = filtered.map(e => e.precio_venta).filter(p => p > 0)
  const minPrice      = prices.length ? Math.min(...prices) : 0
  const maxPrice      = prices.length ? Math.max(...prices) : 0
  const avgPrice      = prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : 0
  const avgDiscount   = filtered.length ? Math.round(filtered.reduce((s, e) => s + (e.descuento || 0), 0) / filtered.length) : 0
  const uniqueSellers = new Set(filtered.map(e => e.seller)).size

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
        {/* Fecha */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Fecha</span>
            <input type="date" value={date} min={minDate} max={maxDate}
              onChange={e => setDate(e.target.value)}
              className="border border-gray-200 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg outline-none bg-white" />
          </div>
          {date === maxDate && maxDate && (
            <span className="text-[10px] text-green-600 font-semibold mt-0.5 pl-9">✓ Última actualización disponible</span>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Canal */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Canal</span>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todos los canales</option>
            {availableChannels.map(c => <option key={c}>{c}</option>)}
          </select>
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

        {/* Seller */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Seller</span>
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
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Precio mínimo",   value: fmtARS(minPrice),      color: "#16a34a" },
          { label: "Precio promedio", value: fmtARS(avgPrice),      color: "#7c3aed" },
          { label: "Precio máximo",   value: fmtARS(maxPrice),      color: "#dc2626" },
          { label: "Desc. promedio",  value: `${avgDiscount}%`,     color: avgDiscount > 15 ? "#16a34a" : "#6b7280" },
          { label: "Sellers",         value: String(uniqueSellers), color: "#d97706" },
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
            <input type="text" placeholder="Buscar producto, seller, marca..." value={search}
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
                    Seller <SortIcon col="seller" />
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
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Cuotas</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Envío</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e, i) => {
                  const color    = COLORS[e.seller] || "#9ca3af"
                  const hasDiscount       = e.descuento && e.descuento > 0
                  const hasPrecioOriginal = e.precio && e.precio > e.precio_venta
                  const envioVal  = e.envio?.toLowerCase()
                  const hasEnvio  = envioVal && envioVal !== "no" && envioVal.trim() !== ""
                  const isOficial = e.tienda_oficial?.toLowerCase() === "si"
                  const diffPct   = avgPrice > 0 ? Math.round(((e.precio_venta - avgPrice) / avgPrice) * 100) : 0

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
                          <span className="font-medium" style={{ color }}>{e.seller}</span>
                        </span>
                      </td>

                      {/* Canal */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.plataforma}</span>
                      </td>

                      {/* Precio */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="font-black text-gray-900 font-mono">{fmtARS(e.precio_venta)}</div>
                        {hasPrecioOriginal && (
                          <div className="text-[10px] text-gray-400 line-through font-mono">{fmtARS(e.precio)}</div>
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

                      {/* Cuotas */}
                      <td className="px-3 py-3 text-center">
                        {e.cuotas_sin_interes != null && e.cuotas_sin_interes > 0 ? (
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">
                            {e.cuotas_sin_interes}x s/i
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Envío */}
                      <td className="px-3 py-3 text-center">
                        {hasEnvio ? (
                          <span className="flex items-center justify-center gap-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                            <Truck size={9} />{e.envio}
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

const COLUMNS = [
  { field: "ID / SKU del producto",   example: "ej: id, item_id, sku",                status: "pendiente" },
  { field: "Título del producto",     example: "ej: producto, titulo",                status: "pendiente" },
  { field: "Precio actual",           example: "ej: precio, price",                   status: "pendiente" },
  { field: "Precio original / tachado", example: "ej: precio_original, list_price",  status: "pendiente" },
  { field: "Descuento %",             example: "ej: descuento, discount_pct",          status: "pendiente" },
  { field: "Seller / Vendedor",       example: "ej: seller, vendedor",                status: "pendiente" },
  { field: "Canal / Plataforma",      example: "ej: plataforma, canal",               status: "pendiente" },
  { field: "Categoría",              example: "ej: subcategoria, categoria",          status: "pendiente" },
  { field: "Marca / Brand",          example: "ej: marca, brand",                    status: "pendiente" },
  { field: "Fecha",                  example: "ej: fecha, date",                     status: "pendiente" },
  { field: "Cuotas (cantidad)",      example: "ej: cuotas, installments",            status: "pendiente" },
  { field: "Envío gratis (flag)",    example: "ej: free_shipping, envio_gratis",     status: "pendiente" },
  { field: "Región / Ciudad",        example: "ej: region, ciudad, state",           status: "pendiente" },
]

export default function PricingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing Live"
        subtitle="Comparación de precios por seller y canal, dispersión de precios, análisis de cuotas y financiamiento"
      />

      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">En construcción</span>
        <span className="text-xs text-amber-700">Indicá qué columnas de tu DB corresponden a cada campo para activar este módulo.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Vista previa — datos de ejemplo</div>
          <div className="opacity-40 pointer-events-none space-y-2">
            {[
              { seller: "Seller 1", price: "$420.000", disc: "12%", cuotas: "12 sin interés", color: "#16a34a", diff: "-8%" },
              { seller: "Seller 2", price: "$455.000", disc: "5%",  cuotas: "6 sin interés",  color: "#6b7280", diff: "0%" },
              { seller: "Seller 3", price: "$489.000", disc: "0%",  cuotas: "3 sin interés",  color: "#dc2626", diff: "+7%" },
            ].map(p => (
              <div key={p.seller} className="flex items-center gap-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-700">{p.seller}</div>
                  <div className="text-[10px] text-gray-400">{p.cuotas}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-gray-900">{p.price}</div>
                  <div className="text-[10px] font-bold" style={{ color: p.color }}>{p.diff} vs promedio</div>
                </div>
                <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200 font-bold">{p.disc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {[
            { icon: Tag,         label: "Precio mínimo",       value: "—", color: "#16a34a" },
            { icon: BarChart2,   label: "Precio promedio",     value: "—", color: "#7c3aed" },
            { icon: TrendingUp,  label: "Dispersión de precios", value: "—", color: "#d97706" },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm opacity-50">
              <div className="flex items-center gap-2 mb-2">
                <k.icon size={13} style={{ color: k.color }} />
                <div className="text-[10px] uppercase tracking-wider text-gray-400">{k.label}</div>
              </div>
              <div className="text-2xl font-bold text-gray-300">{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-700">Columnas necesarias — indicá el nombre exacto en tu DB</div>
          <span className="text-[10px] text-gray-400">{COLUMNS.length} campos</span>
        </div>
        <div className="divide-y divide-gray-50">
          {COLUMNS.map(c => (
            <div key={c.field} className="flex items-center gap-4 px-5 py-2.5">
              <div className="w-3 h-3 rounded-full bg-amber-200 border border-amber-400 flex-shrink-0" />
              <div className="flex-1 text-xs font-medium text-gray-700">{c.field}</div>
              <div className="text-[10px] text-gray-400 font-mono">{c.example}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
