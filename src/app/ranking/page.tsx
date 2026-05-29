"use client"
import { useMarket } from "@/lib/use-market"
import PageHeader from "@/components/ui/PageHeader"
import { useState, useEffect, useCallback, useRef } from "react"
import clsx from "clsx"
import { TrendingUp, TrendingDown, Trophy, LayoutGrid, List, Search, Download } from "lucide-react"

// ── CLICK SHARE CURVE ─────────────────────────────────────────
const CLICK_SHARE: Record<number, number> = {
  1: 28.5, 2: 15.7, 3: 11.0, 4: 8.1,  5: 6.3,
  6: 4.9,  7: 3.9,  8: 3.2,  9: 2.6, 10: 2.1,
  11: 1.8, 12: 1.5, 13: 1.3, 14: 1.1, 15: 0.9,
  16: 0.8, 17: 0.7, 18: 0.6, 19: 0.5, 20: 0.45,
  21: 0.4, 22: 0.35, 23: 0.3, 24: 0.28, 25: 0.25,
  26: 0.22, 27: 0.20, 28: 0.18, 29: 0.16, 30: 0.15,
}
function clickShare(pos: number) { return CLICK_SHARE[Math.min(30, Math.max(1, pos))] || 0.15 }
const MAX_CLICK = CLICK_SHARE[1]
function posWeight(pos: number) { return Math.round((clickShare(pos) / MAX_CLICK) * 100) }

// ── TYPES ─────────────────────────────────────────────────────
interface RankingProduct {
  id: string
  titulo: string
  marca: string
  seller: string
  ranking: number
  appearances_p1: number
  appearances_total: number
}

// ── HELPERS ───────────────────────────────────────────────────
function SellerInitial({ seller, size = 20, color }: { seller: string | null; size?: number; color?: string }) {
  const bg = color || "#A427FF"
  const name = seller || "?"
  const initials = name.length <= 3 ? name : name.slice(0, 2).toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center font-black text-white flex-shrink-0 select-none"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}

function PosChange({ val }: { val: number }) {
  if (val < 0) return <span className="text-green-600 text-xs flex items-center gap-0.5 font-bold"><TrendingUp size={10} />{Math.abs(val)}</span>
  if (val > 0) return <span className="text-red-600 text-xs flex items-center gap-0.5 font-bold"><TrendingDown size={10} />+{val}</span>
  return <span className="text-gray-300 text-xs">—</span>
}

// ── PLANOGRAMA ────────────────────────────────────────────────
function PlanogramaDigital({
  entries,
  selectedSeller,
  colors,
}: {
  entries: RankingProduct[]
  selectedSeller: string
  colors: Record<string, string>
}) {
  const rows: RankingProduct[][] = []
  for (let i = 0; i < entries.length; i += 5) rows.push(entries.slice(i, i + 5))

  return (
    <div className="space-y-2">
      {/* Leyenda */}
      <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-3 flex-wrap">
        <span className="font-semibold uppercase tracking-wider">Potencial de captura por posición →</span>
        {[1, 3, 5, 10, 20, 30].map(p => (
          <div key={p} className="flex items-center gap-1">
            <div className="rounded" style={{ width: 11, height: 11, backgroundColor: `rgba(164,39,255,${posWeight(p) / 100})`, border: "1px solid #e5e7eb" }} />
            <span>#{p}={posWeight(p)}%</span>
          </div>
        ))}
      </div>

      {/* Góndola */}
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-5 gap-2">
          {row.map((entry, ci) => {
            const pos    = ri * 5 + ci + 1   // posición visual en el ranking
            const weight = posWeight(pos)
            const isOwn  = entry.seller === selectedSeller
            const color  = isOwn ? (colors[entry.seller] || "#A427FF") : (colors[entry.seller] || "#9ca3af")
            const isTop3  = pos <= 3
            const isTop10 = pos <= 10

            return (
              <div
                key={entry.id}
                className={clsx(
                  "relative rounded-xl border-2 p-2.5 transition-all",
                  isOwn ? "shadow-md" : "border-gray-100",
                  isTop3 ? "bg-gradient-to-b from-yellow-50 to-white" :
                  isTop10 ? "bg-gray-50/80" : "bg-white opacity-70"
                )}
                style={{ borderColor: isOwn ? color : isTop3 ? "#fde68a" : "#f3f4f6" }}
              >
                {/* Pos */}
                <div className="flex items-start justify-between mb-1.5">
                  <span className={clsx(
                    "text-[10px] font-black font-mono rounded px-1.5 py-0.5",
                    pos === 1 ? "bg-yellow-400 text-yellow-900" :
                    pos <= 3  ? "bg-yellow-100 text-yellow-700" :
                    pos <= 10 ? "bg-gray-100 text-gray-600" : "bg-gray-50 text-gray-400"
                  )}>#{pos}</span>
                  {pos === 1 && <Trophy size={10} className="text-yellow-500" />}
                  {isOwn && (
                    <span className="text-[9px] font-black rounded px-1 py-0.5" style={{ backgroundColor: color + "20", color }}>tú</span>
                  )}
                </div>

                {/* Seller */}
                <div className="flex items-center gap-1.5 mb-1">
                  <SellerInitial seller={entry.seller} size={14} color={color} />
                  <span className="text-[10px] font-bold truncate" style={{ color: isOwn ? color : "#374151" }}>
                    {entry.seller}
                  </span>
                </div>

                {/* Producto */}
                <div className="text-[9px] text-gray-400 truncate leading-tight mb-2">
                  {entry.titulo}
                </div>

                {/* Barra peso */}
                <div className="mt-auto">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-gray-400">Potencial</span>
                    <span className="text-[9px] font-black" style={{ color: isTop3 ? "#d97706" : "#6b7280" }}>{weight}%</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: weight + "%", backgroundColor: isOwn ? color : isTop3 ? "#f59e0b" : "#d1d5db" }} />
                  </div>
                </div>

                {/* Marca + stats */}
                {entry.marca && (
                  <div className="text-[9px] text-gray-300 font-mono mt-1.5 truncate">{entry.marca}</div>
                )}
                <div className="text-[9px] text-gray-300 font-mono flex justify-between mt-0.5">
                  <span>P1: {entry.appearances_p1}x</span>
                  <span>avg {entry.ranking}</span>
                </div>
              </div>
            )
          })}
          {/* Completar fila */}
          {row.length < 5 && Array.from({ length: 5 - row.length }).map((_, i) => (
            <div key={`empty-${i}`} className="rounded-xl border border-dashed border-gray-100 bg-gray-50/30 p-2.5 opacity-30" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── PAGE ──────────────────────────────────────────────────────
export default function RankingPage() {
  const market = useMarket()
  const COLORS  = market.colors
  const SELLERS = market.sellers

  const [channel,   setChannel]   = useState("")
  const [category,  setCategory]  = useState("")
  const [country,   setCountry]   = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [minDate,   setMinDate]   = useState("")
  const [maxDate,   setMaxDate]   = useState("")
  const [pageFilter, setPageFilter] = useState<"all" | "p1">("p1")
  const [topN,      setTopN]      = useState(30)
  const [view,      setView]      = useState<"planograma" | "lista">("planograma")
  const [search,    setSearch]    = useState("")

  const [availableCountries,  setAvailableCountries]  = useState<string[]>([])
  const [availableChannels,   setAvailableChannels]   = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [selectedSeller, setSelectedSeller] = useState("")

  const [data,    setData]    = useState<RankingProduct[]>([])
  const [kpiData, setKpiData] = useState<RankingProduct[]>([])
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

  // Default seller = Newsan
  useEffect(() => {
    if (SELLERS.length === 0) return
    const preferred = SELLERS.find(s => s === "Abbott") ?? SELLERS[0]
    setSelectedSeller(preferred)
  }, [SELLERS[0]])

  // Countries
  useEffect(() => {
    fetch('/api/sos?action=countries').then(r => r.json()).then((d: string[]) => {
      if (Array.isArray(d)) setAvailableCountries(d)
    })
  }, [])

  // Rango de fechas
  useEffect(() => {
    fetch("/api/sos?action=dates")
      .then(r => r.json())
      .then((d: { min: string; max: string }) => {
        setMinDate(d.min); setMaxDate(d.max)
        setStartDate(d.min); setEndDate(d.max)
      })
      .catch(() => {})
  }, [])

  // Cascading channels
  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    if (category)  p.set("category",  category)
    if (country)   p.set("country",   country)
    if (startDate) p.set("startDate", startDate)
    if (endDate)   p.set("endDate",   endDate)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableChannels(d)
      if (channel && !d.includes(channel)) setChannel("")
    })
  }, [category, country, startDate, endDate])

  // Cascading categories
  useEffect(() => {
    const p = new URLSearchParams({ action: "categories" })
    if (channel)   p.set("channel",   channel)
    if (country)   p.set("country",   country)
    if (startDate) p.set("startDate", startDate)
    if (endDate)   p.set("endDate",   endDate)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableCategories(d)
      if (category && !d.includes(category)) setCategory("")
    })
  }, [channel, country, startDate, endDate])

  // Fetch ranking data
  const fetchData = useCallback(() => {
    if (!startDate || !endDate) return
    setLoading(true)
    const p = new URLSearchParams({
      action:      "ranking",
      page_filter: pageFilter,
      limit:       String(topN),
    })
    if (channel)        p.set("channel",   channel)
    if (category)       p.set("category",  category)
    if (country)        p.set("country",   country)
    if (startDate)      p.set("startDate", startDate)
    if (endDate)        p.set("endDate",   endDate)
    if (selectedSeller) p.set("seller",    selectedSeller)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [channel, category, country, startDate, endDate, pageFilter, topN, selectedSeller])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch KPI data — siempre Abbott vs todos, ignora filtro de seller
  const KPI_SELLER = "Abbott"
  const fetchKpiData = useCallback(() => {
    if (!startDate || !endDate) return
    const p = new URLSearchParams({
      action:      "ranking",
      page_filter: pageFilter,
      limit:       "200",
    })
    if (channel)   p.set("channel",   channel)
    if (category)  p.set("category",  category)
    if (country)   p.set("country",   country)
    if (startDate) p.set("startDate", startDate)
    if (endDate)   p.set("endDate",   endDate)
    // sin seller → trae todos
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setKpiData(Array.isArray(d) ? d : []))
  }, [channel, category, country, startDate, endDate, pageFilter])

  useEffect(() => { fetchKpiData() }, [fetchKpiData])

  // Filtrar por búsqueda de texto
  const filtered = data.filter(e =>
    !search ||
    e.titulo.toLowerCase().includes(search.toLowerCase()) ||
    e.seller.toLowerCase().includes(search.toLowerCase()) ||
    e.marca?.toLowerCase().includes(search.toLowerCase())
  )

  // KPIs — siempre Abbott vs todos (ignora filtro de seller)
  const kpiNewsan    = kpiData.filter(e => e.seller === KPI_SELLER)
  const kpiBestRank  = (() => { const idx = kpiData.findIndex(e => e.seller === KPI_SELLER); return idx >= 0 ? idx + 1 : null })()
  const kpiTop3      = kpiData.slice(0, 3).filter(e => e.seller === KPI_SELLER).length
  const kpiTop10     = kpiData.slice(0, 10).filter(e => e.seller === KPI_SELLER).length
  const kpiBestScore = kpiNewsan.length > 0 ? kpiNewsan[0].ranking : null
  const kpiCapture   = kpiNewsan.length
    ? Math.round(kpiNewsan.reduce((s, e) => {
        const pos = kpiData.findIndex(k => k.id === e.id) + 1
        return s + posWeight(pos)
      }, 0) / kpiNewsan.length)
    : 0

  // Sellers presentes en resultados (para colores)
  const sellersInView = Array.from(new Set(data.map(e => e.seller)))

  function downloadCSV() {
    const datePart = startDate && endDate ? `${startDate}_${endDate}` : "todas-las-fechas"
    const chanPart = (channel || "todos-canales").replace(/\s+/g, "-")
    const catPart  = (category || "todas-categorias").replace(/\s+/g, "-")
    const sellPart = (selectedSeller || "todos-sellers").replace(/\s+/g, "-")

    const headers = ["Posición", "Título", "Fabricante", "Marca", "Score Promedio", "Ap. Pág 1", "Ap. Total", "Potencial (%)"]
    const rows = filtered.map((e, i) => [
      String(i + 1),
      e.titulo,
      e.seller,
      e.marca || "",
      String(e.ranking),
      String(e.appearances_p1),
      String(e.appearances_total),
      String(posWeight(i + 1)),
    ])

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = [headers, ...rows].map(row => row.map(esc).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ranking_${datePart}_${chanPart}_${catPart}_${sellPart}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Planograma Digital · Ranking"
        subtitle="Posiciones reales en la góndola virtual ponderadas por potencial de captura"
      />

      {/* ── Filtros ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl">

        {/* Fechas */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Desde</span>
          <input type="date" value={startDate} min={minDate} max={endDate || maxDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg outline-none bg-white"
          />
          <span className="text-xs text-gray-400">Hasta</span>
          <input type="date" value={endDate} min={startDate || minDate} max={maxDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg outline-none bg-white"
          />
        </div>

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

        {/* Canal */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Canal</span>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white"
          >
            <option value="">Todos los canales</option>
            {availableChannels.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Categoría */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Categoría</span>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white"
          >
            <option value="">Todas las categorías</option>
            {availableCategories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Fabricante con buscador */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fabricante</span>
          <div className="relative" ref={sellerRef}>
            <button
              onClick={() => { setSellerOpen(p => !p); setSellerSearch("") }}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg bg-white hover:border-gray-400 transition-colors min-w-[140px] justify-between"
            >
              <span className="truncate">{selectedSeller || "Todos los sellers"}</span>
              <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {sellerOpen && (
              <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-64">
                <div className="p-2 border-b border-gray-100">
                  <input autoFocus type="text" placeholder="Buscar seller..." value={sellerSearch}
                    onChange={e => setSellerSearch(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-purple-400"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {/* Opción todos */}
                  {"todos los sellers".includes(sellerSearch.toLowerCase()) || sellerSearch === "" ? (
                    <button
                      onClick={() => { setSelectedSeller(""); setSellerOpen(false); setSellerSearch("") }}
                      className={clsx("w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors border-b border-gray-100",
                        selectedSeller === "" ? "text-purple-700 font-semibold bg-purple-50" : "text-gray-500"
                      )}
                    >Todos los sellers</button>
                  ) : null}
                  {SELLERS.filter(s => s.toLowerCase().includes(sellerSearch.toLowerCase())).map(s => (
                    <button key={s}
                      onClick={() => { setSelectedSeller(s); setSellerOpen(false); setSellerSearch("") }}
                      className={clsx("w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors",
                        selectedSeller === s ? "text-purple-700 font-semibold bg-purple-50" : "text-gray-700"
                      )}
                    >{s}</button>
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
                pageFilter === val ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700"
              )}
            >{label}</button>
          ))}
        </div>

        {/* Top N */}
        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {[10, 30, 50].map(n => (
            <button key={n} onClick={() => setTopN(n)}
              className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
                topN === n ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700"
              )}
            >Top {n}</button>
          ))}
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: `Mejor posición · ${KPI_SELLER}`,
            value: kpiBestRank !== null ? `#${kpiBestRank}` : "—",
            color: kpiBestRank !== null && kpiBestRank <= 3 ? "#16a34a" : kpiBestRank !== null && kpiBestRank <= 10 ? "#d97706" : "#6b7280",
            sub: kpiBestScore !== null ? `score prom: ${kpiBestScore}` : undefined,
          },
          {
            label: `Captura ponderada · ${KPI_SELLER}`,
            value: `${kpiCapture}%`,
            sub: `vs todos (${kpiData.length} productos)`,
          },
          {
            label: `Prods. ${KPI_SELLER} en top 3`,
            value: String(kpiTop3),
            color: "#16a34a",
            sub: `de ${kpiData.length} productos totales`,
          },
          {
            label: `Prods. ${KPI_SELLER} en top 10`,
            value: String(kpiTop10),
            color: "#d97706",
            sub: kpiData.length ? `${Math.round(kpiTop10 / kpiData.length * 100)}% del total` : "—",
          },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold" style={{ color: k.color || "#111827" }}>{k.value}</div>
            {k.sub && <div className="text-xs text-gray-400 mt-1">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Tabla / Planograma ─────────────────────────── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400">
              {category || "Todas las categorías"} · {channel || "Todos los canales"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {data.length} productos · {sellersInView.length} sellers presentes
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Buscador */}
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
              <Search size={11} className="text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto, seller, marca..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-xs outline-none w-48 text-gray-700"
              />
            </div>
            {/* Descarga CSV */}
            <button
              onClick={downloadCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Descargar CSV con los filtros actuales"
            >
              <Download size={12} />
              <span>CSV</span>
            </button>
            {/* Vista toggle */}
            <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
              <button onClick={() => setView("planograma")}
                className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  view === "planograma" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700"
                )}>
                <LayoutGrid size={11} /> Planograma
              </button>
              <button onClick={() => setView("lista")}
                className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  view === "lista" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700"
                )}>
                <List size={11} /> Lista
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Sin resultados para los filtros seleccionados</div>
        ) : view === "planograma" ? (
          <PlanogramaDigital entries={filtered} selectedSeller={selectedSeller} colors={COLORS} />
        ) : (
          /* ── Vista lista ── */
          <div className="space-y-1.5">
            {filtered.map((entry, i) => {
              const pos     = i + 1              // posición visual por orden de score
              const w       = posWeight(pos)
              const isOwn   = entry.seller === selectedSeller
              const color   = isOwn ? (COLORS[entry.seller] || "#A427FF") : (COLORS[entry.seller] || "#9ca3af")
              const isTop3  = pos <= 3
              const isTop10 = pos <= 10
              return (
                <div
                  key={entry.id}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm",
                    isOwn ? "border-2 bg-violet-50/50" : "bg-white border-gray-100 hover:bg-gray-50"
                  )}
                  style={isOwn ? { borderColor: color } : {}}
                >
                  {/* Posición */}
                  <span className={clsx(
                    "font-black font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 min-w-[28px] text-center",
                    pos === 1 ? "bg-yellow-100 text-yellow-700" :
                    isTop3    ? "bg-green-50 text-green-700" :
                    isTop10   ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"
                  )}>#{pos}</span>

                  {/* Seller */}
                  <SellerInitial seller={entry.seller} size={22} color={color} />

                  {/* Título + seller + marca */}
                  <div className="flex-1 min-w-0">
                    <div className={clsx("text-xs font-semibold truncate", isOwn ? "" : "text-gray-700")}
                      style={isOwn ? { color } : {}}>
                      {entry.titulo}
                      {isOwn && (
                        <span className="ml-1 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: color + "20", color }}>tú</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">{entry.seller}{entry.marca ? ` · ${entry.marca}` : ""}</div>
                  </div>

                  {/* Score avg */}
                  <div className="hidden lg:block text-right flex-shrink-0">
                    <div className="text-[10px] text-gray-400">Score prom.</div>
                    <div className="text-xs font-bold text-gray-700">{entry.ranking}</div>
                  </div>

                  {/* Apariciones P1 */}
                  <div className="hidden lg:block text-right flex-shrink-0">
                    <div className="text-[10px] text-gray-400">Ap. P1</div>
                    <div className="text-xs font-bold text-gray-700">{entry.appearances_p1}</div>
                  </div>

                  {/* Barra potencial */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: w + "%", backgroundColor: color }} />
                    </div>
                    <span className="text-[10px] font-black w-7 text-right" style={{ color }}>{w}%</span>
                  </div>

                  {pos === 1 && <Trophy size={12} className="text-yellow-500 flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        )}

        {/* Leyenda sellers */}
        {!loading && data.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Fabricantes en resultados</div>
            <div className="flex flex-wrap gap-2">
              {sellersInView.map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[s] || "#9ca3af" }} />
                  <span className="text-xs text-gray-600">{s}</span>
                  <span className="text-[10px] font-mono text-gray-400">
                    ({data.filter(e => e.seller === s).length})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
