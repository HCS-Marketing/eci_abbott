"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useMarket } from "@/lib/use-market"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import { fmtPrice } from "@/lib/format"
import clsx from "clsx"
import { ExternalLink, Trophy, Truck, TrendingUp, Tag, Search, Zap, Download, FileText } from "lucide-react"
import { downloadCSV, exportPDF } from "@/lib/export"

// ─── TYPES ────────────────────────────────────────────────────
interface BestsellerProduct {
  id: string; rank: number; titulo: string; marca: string; seller: string
  subcategoria: string; plataforma: string
  precio_venta: number; precio: number; descuento: number
  url_producto: string; envio: string; tienda_oficial: string
  full: string; oferta_relampago: string; cuotas_sin_interes: number | null; cupon: string
  ranking: number; appearances_p1: number; appearances_total: number
}

// ─── HELPERS ──────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  return (
    <div className={clsx(
      "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0",
      rank === 1 ? "bg-amber-100 text-amber-700" :
      rank === 2 ? "bg-gray-100 text-gray-600"   :
      rank === 3 ? "bg-orange-100 text-orange-700" :
      "bg-gray-50 text-gray-400"
    )}>
      {rank === 1 ? <Trophy size={13} className="text-amber-500" /> : `#${rank}`}
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────
export default function BestsellersPage() {
  const market = useMarket()
  const COLORS  = market.colors
  const SELLERS = market.sellers

  const [channel,   setChannel]   = useState("")
  const [category,  setCategory]  = useState("")
  const [country,   setCountry]   = useState("")
  const [segmento,  setSegmento]  = useState("")
  const [mercado,   setMercado]   = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [minDate,   setMinDate]   = useState("")
  const [maxDate,   setMaxDate]   = useState("")
  const [pageFilter, setPageFilter] = useState<"p1" | "all">("p1")
  const [topN,      setTopN]      = useState(20)
  const [search,    setSearch]    = useState("")
  const [selectedSeller, setSelectedSeller] = useState("")

  const [availableCountries,  setAvailableCountries]  = useState<string[]>([])
  const [availableSegmentos,  setAvailableSegmentos]  = useState<string[]>([])
  const [availableMercados,   setAvailableMercados]   = useState<string[]>([])
  const [availableChannels,   setAvailableChannels]   = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [data,    setData]    = useState<BestsellerProduct[]>([])
  const [loading, setLoading] = useState(false)

  // Seller dropdown
  const [sellerOpen, setSellerOpen] = useState(false)
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

  // Countries
  useEffect(() => {
    fetch('/api/sos?action=countries').then(r => r.json()).then((d: string[]) => {
      if (Array.isArray(d)) setAvailableCountries(d)
    })
  }, [])

  // Segmentos
  useEffect(() => {
    const p = new URLSearchParams({ action: "segmentos" })
    if (country) p.set("country", country)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableSegmentos(d)
      if (segmento && !d.includes(segmento)) setSegmento("")
    })
  }, [country])

  // Mercados
  useEffect(() => {
    const p = new URLSearchParams({ action: "mercados" })
    if (country)  p.set("country", country)
    if (segmento) p.set("segmento", segmento)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableMercados(d)
      if (mercado && !d.includes(mercado)) setMercado("")
    })
  }, [country, segmento])

  // Fecha única — re-fetchea cuando cambia el canal para ajustar al max del canal
  useEffect(() => {
    const p = new URLSearchParams({ action: "dates" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then((d: { min: string; max: string }) => {
        if (!d.max) return
        setMinDate(d.min); setMaxDate(d.max)
        // Si la fecha actual está fuera del rango del canal, ajustar al máximo
        setStartDate(prev => (!prev || prev < d.min) ? d.min : prev)
        setEndDate(prev => (!prev || prev > d.max) ? d.max : prev)
      })
  }, [channel, country])

  // Cascading channels
  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    if (category) p.set("category",  category)
    if (country)  p.set("country",   country)
    if (endDate)  p.set("startDate", startDate || endDate); if (endDate) p.set("endDate", endDate)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableChannels(d)
      if (channel && !d.includes(channel)) setChannel("")
    })
  }, [category, country, endDate])

  // Cascading categories
  useEffect(() => {
    const p = new URLSearchParams({ action: "categories" })
    if (channel) p.set("channel",   channel)
    if (country) p.set("country",   country)
    if (endDate) p.set("startDate", startDate || endDate); if (endDate) p.set("endDate", endDate)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableCategories(d)
      if (category && !d.includes(category)) setCategory("")
    })
  }, [channel, country, endDate])

  // Fetch bestsellers
  const fetchData = useCallback(() => {
    if (!endDate) return
    setLoading(true)
    const p = new URLSearchParams({
      action:      "bestsellers",
      page_filter: pageFilter,
      limit:       String(topN),
      date: endDate,
    })
    if (channel)        p.set("channel",   channel)
    if (category)       p.set("category",  category)
    if (country)        p.set("country",   country)
    if (selectedSeller) p.set("seller",    selectedSeller)
    if (segmento)       p.set("segmento",  segmento)
    if (mercado)        p.set("mercado",   mercado)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [channel, category, country, endDate, pageFilter, topN, selectedSeller, segmento, mercado])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = data.filter(e =>
    !search ||
    e.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    e.seller?.toLowerCase().includes(search.toLowerCase()) ||
    e.marca?.toLowerCase().includes(search.toLowerCase())
  )

  // KPIs
  const avgDiscount  = filtered.length ? Math.round(filtered.reduce((s, e) => s + (e.descuento || 0), 0) / filtered.length) : 0
  const freeShipping = filtered.filter(e => e.envio && e.envio.trim() !== "").length
  const top3         = filtered.slice(0, 3)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bestsellers"
        subtitle="Top productos por posición de ranking ponderada sobre el período seleccionado"
      />

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl">
        {/* Fecha única */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Desde</span>
          <DateInput value={startDate} min={minDate} max={endDate || maxDate} onChange={setStartDate} />
          <span className="text-xs text-gray-400">Hasta</span>
          <DateInput value={endDate} min={startDate || minDate} max={maxDate} onChange={setEndDate} />
        </div>
        {endDate === maxDate && maxDate && (
          <span className="text-[10px] text-green-600 font-semibold">✓ Última fecha</span>
        )}

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* País */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">País</span>
          <select value={country} onChange={e => setCountry(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todos</option>
            {availableCountries.map(c => <option key={c} value={c}>{c === "MX" ? "México" : c === "CO" ? "Colombia" : c === "PE" ? "Perú" : c}</option>)}
          </select>
        </div>

        {/* Mercado */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Mercado</span>
          <select value={mercado} onChange={e => { setMercado(e.target.value); if (!e.target.value) setSegmento("") }}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todos</option>
            {availableMercados.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        {/* Segmento */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Segmento</span>
          <select value={segmento} onChange={e => setSegmento(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todos</option>
            {availableSegmentos.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

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

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Página */}
        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {([["p1", "Página 1"], ["all", "Total"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setPageFilter(val)}
              className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
                pageFilter === val ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
              {label}
            </button>
          ))}
        </div>

        {/* Top N */}
        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {[10, 20, 50].map(n => (
            <button key={n} onClick={() => setTopN(n)}
              className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
                topN === n ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
              Top {n}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => downloadCSV(data as unknown as Record<string, unknown>[], "bestsellers")}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Productos en ranking",   value: String(filtered.length),  color: "#7c3aed", sub: `top ${topN} seleccionado` },
          { label: "Descuento promedio",     value: `${avgDiscount}%`,         color: avgDiscount > 15 ? "#16a34a" : "#6b7280", sub: "en resultados" },
          { label: "Con envío / promo",      value: String(freeShipping),       color: "#2563eb", sub: `de ${filtered.length} productos` },
          { label: "Prod. top 3",            value: top3.map(e => e.seller).filter((s, i, a) => a.indexOf(s) === i).join(" · ") || "—",
            color: "#d97706", sub: "fabricantes en posiciones 1-3" },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold truncate" style={{ color: k.color }}>{k.value}</div>
            {k.sub && <div className="text-xs text-gray-400 mt-1">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Lista ─────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
        {/* Header + buscador */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400">
              {category || "Todas las categorías"} · {channel || "Todos los canales"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{filtered.length} productos</div>
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
          <div className="space-y-2">
            {filtered.map(e => {
              const color = COLORS[e.seller] || "#9ca3af"
              const hasDiscount = e.descuento && e.descuento > 0
              const hasPrecioOriginal = e.precio && e.precio > e.precio_venta
              const isOficial = e.tienda_oficial?.toLowerCase() === "si"
              const isTop3 = e.rank <= 3
              const isFull = e.full?.toUpperCase() === "SI"
              const isRelampago = e.oferta_relampago?.toUpperCase() === "SI"
              const envioVal = e.envio?.toLowerCase()
              const hasEnvio = envioVal && envioVal !== "no" && envioVal.trim() !== ""

              return (
                <div key={e.id} className={clsx(
                  "flex items-start gap-3 px-4 py-3 rounded-xl border transition-all",
                  isTop3 ? "bg-amber-50/40 border-amber-100" : "bg-white border-gray-100 hover:bg-gray-50"
                )}>
                  {/* Rank */}
                  <RankBadge rank={e.rank} />

                  {/* Título + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 leading-snug">
                        {e.titulo}
                      </span>
                      {isOficial && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">Oficial</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-500">
                      {/* Seller dot */}
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-medium" style={{ color }}>{e.seller}</span>
                      </span>
                      {e.marca && <span className="text-gray-400">{e.marca}</span>}
                      {e.subcategoria && <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full text-[10px]">{e.subcategoria}</span>}
                      {e.plataforma && <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full text-[10px] border border-purple-100">{e.plataforma}</span>}
                    </div>
                  </div>

                  {/* Precio + descuento */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {hasPrecioOriginal && (
                      <span className="text-[10px] text-gray-400 line-through font-mono">{fmtPrice(e.precio, country)}</span>
                    )}
                    <span className="text-sm font-black text-gray-900 font-mono">{fmtPrice(e.precio_venta, country)}</span>
                    {hasDiscount && (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">-{e.descuento}%</span>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {/* Fila: Full + Oferta relámpago */}
                    <div className="flex items-center gap-1">
                      {isFull && (
                        <span title="Mercado Libre Full" className="flex items-center gap-0.5 text-[9px] font-black text-white bg-green-500 px-1.5 py-0.5 rounded-full">
                          <Zap size={8} className="fill-white" />Full
                        </span>
                      )}
                      {isRelampago && (
                        <span title="Oferta relámpago" className="flex items-center gap-0.5 text-[9px] font-black text-white bg-orange-500 px-1.5 py-0.5 rounded-full">
                          <Zap size={8} className="fill-white" />Relámpago
                        </span>
                      )}
                    </div>
                    {hasEnvio && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                        <Truck size={8} />{e.envio}
                      </span>
                    )}
                    {/* Cuotas */}
                    {e.cuotas_sin_interes != null && e.cuotas_sin_interes > 0 && (
                      <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">
                        {e.cuotas_sin_interes}x s/i
                      </span>
                    )}
                    {/* Cupón */}
                    {e.cupon && e.cupon.trim() !== "" && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                        🏷 {e.cupon}
                      </span>
                    )}
                    {/* Link */}
                    {e.url_producto && (
                      <a href={e.url_producto} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-purple-600 transition-colors bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full">
                        <ExternalLink size={8} />ver
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}




