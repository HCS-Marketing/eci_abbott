"use client"
import { useState, useEffect, useCallback } from "react"
import { useMarket } from "@/lib/use-market"
import PageHeader from "@/components/ui/PageHeader"
import clsx from "clsx"
import { Search, Trophy, Truck, ExternalLink, AlertTriangle } from "lucide-react"

// ─── TYPES ────────────────────────────────────────────────────
interface BuyboxRow {
  id: string; producto: string; marca: string; subcategoria: string; plataforma: string
  winner_seller: string; winner_price: number; winner_precio_original: number
  winner_descuento: number; winner_envio: string; winner_url: string; winner_ranking: number
  total_sellers: number; newsan_price: number | null; newsan_ranking: number | null
  newsan_envio: string | null; newsan_cuotas: number | null
  newsan_present: boolean; newsan_wins: boolean
}

interface BuyboxLostRow {
  id: string; producto: string; marca: string; subcategoria: string; plataforma: string
  current_winner: string; current_price: number; current_envio: string | null
  winner_url: string | null; days_won: number; newsan_price: number | null; latest_date: string
}

function fmtARS(n: number | null) {
  if (n == null || n === 0) return "—"
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

type ShowMode = "all" | "wins" | "loses" | "gaps" | "lost7d"

// ─── PAGE ─────────────────────────────────────────────────────
export default function BuyboxPage() {
  useMarket()

  const [channel,  setChannel]  = useState("")
  const [category, setCategory] = useState("")
  const [date,     setDate]     = useState("")
  const [minDate,  setMinDate]  = useState("")
  const [maxDate,  setMaxDate]  = useState("")
  const [topN,     setTopN]     = useState(100)
  const [show,     setShow]     = useState<ShowMode>("all")
  const [search,   setSearch]   = useState("")

  const [availableChannels,   setAvailableChannels]   = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [data,     setData]     = useState<BuyboxRow[]>([])
  const [lostData, setLostData] = useState<BuyboxLostRow[]>([])
  const [loading,  setLoading]  = useState(false)

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

  // Fetch buybox
  const fetchData = useCallback(() => {
    setLoading(true)
    if (show === "lost7d") {
      const p = new URLSearchParams({ action: "buybox_lost", limit: String(topN) })
      if (channel)  p.set("channel",  channel)
      if (category) p.set("category", category)
      fetch(`/api/sos?${p}`)
        .then(r => r.json())
        .then(d => setLostData(Array.isArray(d) ? d : []))
        .finally(() => setLoading(false))
    } else {
      if (!date) { setLoading(false); return }
      const p = new URLSearchParams({ action: "buybox", limit: String(topN), date, show })
      if (channel)  p.set("channel",  channel)
      if (category) p.set("category", category)
      fetch(`/api/sos?${p}`)
        .then(r => r.json())
        .then(d => setData(Array.isArray(d) ? d : []))
        .finally(() => setLoading(false))
    }
  }, [channel, category, date, topN, show])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = data.filter(e =>
    !search ||
    e.producto?.toLowerCase().includes(search.toLowerCase()) ||
    e.winner_seller?.toLowerCase().includes(search.toLowerCase()) ||
    e.marca?.toLowerCase().includes(search.toLowerCase())
  )

  // KPIs — modo normal
  const wins   = filtered.filter(e => e.newsan_wins).length
  const loses  = filtered.filter(e => e.newsan_present && !e.newsan_wins).length
  const gaps   = filtered.filter(e => !e.newsan_present).length
  const winRate = (wins + loses) > 0 ? Math.round(wins / (wins + loses) * 100) : 0

  // KPIs — modo lost7d
  const lostFiltered = lostData.filter(e =>
    !search ||
    e.producto?.toLowerCase().includes(search.toLowerCase()) ||
    e.current_winner?.toLowerCase().includes(search.toLowerCase()) ||
    e.marca?.toLowerCase().includes(search.toLowerCase())
  )
  const lostWithPrice = lostFiltered.filter(e => e.newsan_price != null).length
  const lostGaps      = lostFiltered.filter(e => e.newsan_price == null).length
  const avgDays       = lostFiltered.length > 0
    ? Math.round(lostFiltered.reduce((s, e) => s + e.days_won, 0) / lostFiltered.length)
    : 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="BuyBox"
        subtitle="Quién gana la posición destacada por producto — Newsan vs competencia"
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
          {([
            ["all",    "Todos"],
            ["wins",   "Newsan gana"],
            ["loses",  "Newsan pierde"],
            ["gaps",   "Gaps"],
            ["lost7d", "📉 Perdió (7d)"],
          ] as const).map(([val, label]) => (
            <button key={val} onClick={() => setShow(val)}
              className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
                show === val ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
              {label}
            </button>
          ))}
        </div>

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {show === "lost7d" ? [
          {
            label: "Perdieron BuyBox",
            value: String(lostFiltered.length),
            color: "#dc2626",
            sub: "tuvieron BB en 7d, hoy ya no",
          },
          {
            label: "Newsan aún presente",
            value: String(lostWithPrice),
            color: "#d97706",
            sub: "están en el listing pero no ganan",
          },
          {
            label: "Newsan desapareció",
            value: String(lostGaps),
            color: "#6b7280",
            sub: "no están en el listing hoy",
          },
          {
            label: "Días promedio con BB",
            value: String(avgDays),
            color: "#7c3aed",
            sub: "promedio en los 7 días anteriores",
          },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            {k.sub && <div className="text-xs text-gray-400 mt-1">{k.sub}</div>}
          </div>
        )) : [
          {
            label: "Win Rate BuyBox",
            value: `${winRate}%`,
            color: winRate >= 50 ? "#16a34a" : winRate >= 30 ? "#d97706" : "#dc2626",
            sub: "sobre productos donde Newsan compite",
          },
          {
            label: "Newsan gana",
            value: String(wins),
            color: "#16a34a",
            sub: "productos donde Newsan es #1",
          },
          {
            label: "Newsan pierde",
            value: String(loses),
            color: "#d97706",
            sub: "presente pero no gana BuyBox",
          },
          {
            label: "Gaps",
            value: String(gaps),
            color: "#6b7280",
            sub: "productos sin Newsan",
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
            <div className="text-xs text-gray-500 mt-0.5">
              {show === "lost7d" ? lostFiltered.length : filtered.length} productos
            </div>
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
        ) : show === "lost7d" ? (
          lostFiltered.length === 0 ? (
            <div className="text-center py-14 text-gray-400 text-sm">Sin productos que perdieron BuyBox en los últimos 7 días</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Producto</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Días con BB</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Nuevo Winner</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">P. Winner</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">P. Newsan hoy</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Diferencia</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lostFiltered.map((e, i) => {
                    const diff = e.newsan_price != null
                      ? Math.round(((e.newsan_price - e.current_price) / e.current_price) * 100)
                      : null
                    return (
                      <tr key={`${e.id}-${i}`} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-medium text-gray-800 leading-snug mb-0.5">{e.producto}</div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {e.marca        && <span className="text-[10px] text-gray-400">{e.marca}</span>}
                            {e.subcategoria && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">· {e.subcategoria}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.plataforma}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            {e.days_won}d
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                            {e.current_winner}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="font-black text-gray-900 font-mono">{fmtARS(e.current_price)}</div>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {e.newsan_price != null
                            ? <div className="font-mono text-gray-700">{fmtARS(e.newsan_price)}</div>
                            : <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Sin Newsan</span>
                          }
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {diff != null && diff !== 0 ? (
                            <span className={clsx("text-[10px] font-bold", diff > 0 ? "text-red-500" : "text-green-600")}>
                              {diff > 0 ? "+" : ""}{diff}%
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {e.winner_url && (
                            <a href={e.winner_url} target="_blank" rel="noopener noreferrer"
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
          )
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm">Sin resultados para los filtros seleccionados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Producto</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">BuyBox Winner</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">P. Winner</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">P. Newsan</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Score Newsan</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Sellers</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Cuotas</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e, i) => {
                  const envioVal  = e.winner_envio?.toLowerCase()
                  const hasEnvio  = envioVal && envioVal !== "no" && envioVal.trim() !== ""
                  const priceDiff = e.newsan_price != null && !e.newsan_wins
                    ? Math.round(((e.newsan_price - e.winner_price) / e.winner_price) * 100)
                    : null

                  return (
                    <tr key={`${e.id}-${i}`}
                      className={clsx("transition-colors",
                        e.newsan_wins  ? "bg-green-50/40 hover:bg-green-50"  :
                        !e.newsan_present ? "opacity-60 hover:opacity-80 hover:bg-gray-50" :
                        "hover:bg-gray-50"
                      )}>

                      {/* Producto */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-medium text-gray-800 leading-snug mb-0.5">{e.producto}</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {e.marca       && <span className="text-[10px] text-gray-400">{e.marca}</span>}
                          {e.subcategoria && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">· {e.subcategoria}</span>}
                        </div>
                      </td>

                      {/* Canal */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.plataforma}</span>
                      </td>

                      {/* BuyBox Winner */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {e.newsan_wins ? (
                          <span className="flex items-center gap-1 text-[10px] font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                            <Trophy size={9} className="text-amber-500" />Newsan
                          </span>
                        ) : !e.newsan_present ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-gray-500">
                            <AlertTriangle size={9} className="text-amber-400" />{e.winner_seller}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                            {e.winner_seller}
                          </span>
                        )}
                        {hasEnvio && (
                          <span className="flex items-center gap-0.5 text-[9px] text-blue-500 mt-0.5">
                            <Truck size={8} />{e.winner_envio}
                          </span>
                        )}
                      </td>

                      {/* Precio Winner */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="font-black text-gray-900 font-mono">{fmtARS(e.winner_price)}</div>
                        {e.winner_descuento > 0 && (
                          <div className="text-[9px] font-bold text-green-600">-{e.winner_descuento}%</div>
                        )}
                      </td>

                      {/* Precio Newsan */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {e.newsan_wins ? (
                          <span className="text-gray-300 text-[10px]">= winner</span>
                        ) : e.newsan_price != null ? (
                          <div>
                            <div className="font-mono text-gray-700">{fmtARS(e.newsan_price)}</div>
                            {priceDiff != null && priceDiff !== 0 && (
                              <div className={clsx("text-[9px] font-bold", priceDiff > 0 ? "text-red-500" : "text-green-600")}>
                                {priceDiff > 0 ? "+" : ""}{priceDiff}%
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Sin Newsan</span>
                        )}
                      </td>

                      {/* Score Newsan */}
                      <td className="px-3 py-3 text-center">
                        {e.newsan_ranking != null ? (
                          <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                            e.newsan_wins
                              ? "text-green-700 bg-green-50 border-green-200"
                              : "text-gray-600 bg-gray-50 border-gray-200")}>
                            {e.newsan_ranking}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* # Sellers */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-gray-500">{e.total_sellers}</span>
                      </td>

                      {/* Cuotas Newsan */}
                      <td className="px-3 py-3 text-center">
                        {e.newsan_cuotas != null && e.newsan_cuotas > 0 ? (
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">
                            {e.newsan_cuotas}x s/i
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Link */}
                      <td className="px-3 py-3 text-center">
                        {e.winner_url && (
                          <a href={e.winner_url} target="_blank" rel="noopener noreferrer"
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
