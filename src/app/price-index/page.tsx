"use client"
import { useState, useEffect, useCallback } from "react"
import { useMarket } from "@/lib/use-market"
import PageHeader from "@/components/ui/PageHeader"
import clsx from "clsx"
import { Search, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"

// ─── TYPES ────────────────────────────────────────────────────
interface PriceIndexRow {
  id: string; producto: string; marca: string; subcategoria: string; plataforma: string
  avg_price: number; min_price: number
  newsan_price: number | null; comp_avg_price: number | null; comp_min_price: number | null
  competitor_count: number; newsan_cuotas: number | null; price_index: number | null
}

// ─── HELPERS ──────────────────────────────────────────────────
function fmtARS(n: number | null) {
  if (n == null || n === 0) return "—"
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

function IndexBadge({ idx }: { idx: number | null }) {
  if (idx == null) return <span className="text-gray-300 text-xs">S/D</span>
  const color = idx <= 95  ? "bg-green-100 text-green-700 border-green-200"
              : idx <= 105 ? "bg-amber-100 text-amber-700 border-amber-200"
              :              "bg-red-100 text-red-600 border-red-200"
  const Icon  = idx <= 100 ? TrendingDown : TrendingUp
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full border", color)}>
      <Icon size={10} />
      {idx.toFixed(1)}
    </span>
  )
}

type ShowMode = "newsan" | "all" | "gaps"

// ─── PAGE ─────────────────────────────────────────────────────
export default function PriceIndexPage() {
  useMarket()   // only needed for context

  const [channel,  setChannel]  = useState("")
  const [category, setCategory] = useState("")
  const [date,     setDate]     = useState("")
  const [minDate,  setMinDate]  = useState("")
  const [maxDate,  setMaxDate]  = useState("")
  const [topN,     setTopN]     = useState(200)
  const [show,     setShow]     = useState<ShowMode>("newsan")
  const [search,   setSearch]   = useState("")

  const [availableChannels,   setAvailableChannels]   = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [data,    setData]    = useState<PriceIndexRow[]>([])
  const [loading, setLoading] = useState(false)

  // Fecha canal-aware
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

  // Fetch data
  const fetchData = useCallback(() => {
    if (!date) return
    setLoading(true)
    const p = new URLSearchParams({ action: "price_index", limit: String(topN), date, show })
    if (channel)  p.set("channel",  channel)
    if (category) p.set("category", category)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [channel, category, date, topN, show])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter
  const filtered = data.filter(e =>
    !search ||
    e.producto?.toLowerCase().includes(search.toLowerCase()) ||
    e.marca?.toLowerCase().includes(search.toLowerCase()) ||
    e.subcategoria?.toLowerCase().includes(search.toLowerCase())
  )

  // KPIs
  const withNewsan    = filtered.filter(e => e.newsan_price != null)
  const withIndex     = withNewsan.filter(e => e.price_index != null)
  const avgIndex      = withIndex.length ? Math.round(withIndex.reduce((s, e) => s + e.price_index!, 0) / withIndex.length * 10) / 10 : null
  const pctCompetitive = withIndex.length ? Math.round(withIndex.filter(e => e.price_index! <= 100).length / withIndex.length * 100) : 0
  const cheapest      = withNewsan.filter(e => e.newsan_price != null && e.comp_min_price != null && e.newsan_price <= e.comp_min_price).length
  const gaps          = filtered.filter(e => e.newsan_price == null).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Price Index"
        subtitle="Índice de precio Newsan vs competencia — 100 = paridad, < 100 = más barato, > 100 = más caro"
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

        {/* Show toggle */}
        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {([["newsan", "Con Newsan"], ["all", "Todos"], ["gaps", "Gaps"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setShow(val)}
              className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
                show === val ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
              {label}
            </button>
          ))}
        </div>

        {/* Límite */}
        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {[100, 200, 500].map(n => (
            <button key={n} onClick={() => setTopN(n)}
              className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
                topN === n ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Índice promedio",
            value: avgIndex != null ? avgIndex.toFixed(1) : "—",
            color: avgIndex == null ? "#6b7280" : avgIndex <= 95 ? "#16a34a" : avgIndex <= 105 ? "#d97706" : "#dc2626",
            sub: "Newsan vs avg competencia",
          },
          {
            label: "% Competitivo",
            value: `${pctCompetitive}%`,
            color: pctCompetitive >= 70 ? "#16a34a" : pctCompetitive >= 50 ? "#d97706" : "#dc2626",
            sub: "productos con índice ≤ 100",
          },
          {
            label: "Más barato que todos",
            value: String(cheapest),
            color: "#7c3aed",
            sub: "por debajo del mín de competencia",
          },
          {
            label: "Gaps (sin Newsan)",
            value: String(gaps),
            color: "#6b7280",
            sub: "productos sin presencia Newsan",
          },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            {k.sub && <div className="text-xs text-gray-400 mt-1">{k.sub}</div>}
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
            <div className="text-xs text-gray-500 mt-0.5">{filtered.length} productos</div>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
            <Search size={12} className="text-gray-400" />
            <input type="text" placeholder="Buscar producto, marca, categoría..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-400 w-52" />
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-50 bg-gray-50/50">
          {[
            { color: "bg-green-100 border-green-200 text-green-700", label: "≤ 95 — Competitivo" },
            { color: "bg-amber-100 border-amber-200 text-amber-700", label: "95–105 — En paridad" },
            { color: "bg-red-100 border-red-200 text-red-600",       label: "> 105 — Caro" },
          ].map(l => (
            <span key={l.label} className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full border", l.color)}>{l.label}</span>
          ))}
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
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">P. Newsan</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Avg comp.</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Índice</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Mín comp.</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Sellers</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Cuotas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e, i) => {
                  const isGap      = e.newsan_price == null
                  const isCheapest = !isGap && e.comp_min_price != null && e.newsan_price! <= e.comp_min_price
                  return (
                    <tr key={`${e.id}-${i}`}
                      className={clsx("hover:bg-gray-50 transition-colors", isGap && "opacity-60")}>
                      {/* Producto */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-start gap-1.5 mb-0.5 flex-wrap">
                          <span className="font-medium text-gray-800 leading-snug">{e.producto}</span>
                          {isCheapest && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 flex-shrink-0">Más barato</span>
                          )}
                          {isGap && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 flex-shrink-0 flex items-center gap-0.5">
                              <AlertTriangle size={8} />Gap
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {e.marca && <span className="text-[10px] text-gray-400">{e.marca}</span>}
                          {e.subcategoria && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">· {e.subcategoria}</span>}
                        </div>
                      </td>

                      {/* Canal */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.plataforma}</span>
                      </td>

                      {/* Precio Newsan */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {isGap ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className="font-black text-gray-900 font-mono">{fmtARS(e.newsan_price)}</span>
                        )}
                      </td>

                      {/* Avg competencia */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <span className="font-mono text-gray-600">{fmtARS(e.comp_avg_price)}</span>
                      </td>

                      {/* Índice */}
                      <td className="px-3 py-3 text-center">
                        <IndexBadge idx={e.price_index} />
                      </td>

                      {/* Mín competencia */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <span className="font-mono text-gray-500">{fmtARS(e.comp_min_price)}</span>
                      </td>

                      {/* # Sellers */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-gray-500">{e.competitor_count}</span>
                      </td>

                      {/* Cuotas Newsan */}
                      <td className="px-3 py-3 text-center">
                        {e.newsan_cuotas != null && e.newsan_cuotas > 0 ? (
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">
                            {e.newsan_cuotas}x s/i
                          </span>
                        ) : <span className="text-gray-300">—</span>}
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
