"use client"
import { useState, useEffect, useCallback } from "react"
import { useMarket } from "@/lib/use-market"
import PageHeader from "@/components/ui/PageHeader"
import { fmtPrice } from "@/lib/format"
import clsx from "clsx"
import { Search, Trophy, Truck, ExternalLink, AlertTriangle, Download, FileText } from "lucide-react"
import { downloadCSV, exportPDF } from "@/lib/export"

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
  winner_seller: string; winner_price: number; winner_envio: string | null
  winner_url: string | null; newsan_price: number | null; newsan_wins: boolean; latest_date: string
}

// ─── PAGE ─────────────────────────────────────────────────────
export default function BuyboxPage() {
  useMarket()

  const [channel,  setChannel]  = useState("")
  const [category, setCategory] = useState("")
  const [country,  setCountry]  = useState("")
  const [segmento, setSegmento] = useState("")
  const [mercado,  setMercado]  = useState("")
  const [topN,     setTopN]     = useState(100)
  const [search,   setSearch]   = useState("")

  const [availableCountries,  setAvailableCountries]  = useState<string[]>([])
  const [availableSegmentos,  setAvailableSegmentos]  = useState<string[]>([])
  const [availableMercados,   setAvailableMercados]   = useState<string[]>([])
  const [availableChannels,   setAvailableChannels]   = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [lostData, setLostData] = useState<BuyboxLostRow[]>([])
  const [loading,  setLoading]  = useState(false)

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

  // Cascading channels
  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    if (category) p.set("category", category)
    if (country)  p.set("country",  country)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableChannels(d)
      if (channel && !d.includes(channel)) setChannel("")
    })
  }, [category, country])

  // Cascading categories
  useEffect(() => {
    const p = new URLSearchParams({ action: "categories" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableCategories(d)
      if (category && !d.includes(category)) setCategory("")
    })
  }, [channel, country])

  // Fetch buybox Newsan 7d
  const fetchData = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ action: "buybox_lost", limit: String(topN) })
    if (channel)  p.set("channel",  channel)
    if (category) p.set("category", category)
    if (country)  p.set("country",  country)
    if (segmento) p.set("segmento", segmento)
    if (mercado)  p.set("mercado",  mercado)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setLostData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [channel, category, country, topN, segmento, mercado])

  useEffect(() => { fetchData() }, [fetchData])

  const lostFiltered = lostData.filter(e =>
    !search ||
    e.producto?.toLowerCase().includes(search.toLowerCase()) ||
    e.winner_seller?.toLowerCase().includes(search.toLowerCase()) ||
    e.marca?.toLowerCase().includes(search.toLowerCase())
  )
  const lostWins    = lostFiltered.filter(e => e.newsan_wins).length
  const lostLoses   = lostFiltered.filter(e => !e.newsan_wins && e.newsan_price != null).length
  const lostWinRate = (lostWins + lostLoses) > 0
    ? Math.round(lostWins / (lostWins + lostLoses) * 100)
    : 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="BuyBox"
        subtitle="Quién gana la posición destacada por producto — Abbott vs competencia"
      />

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl">
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
          <button onClick={() => downloadCSV(lostData as unknown as Record<string, unknown>[], "buybox")}
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
          {
            label: "Productos universo",
            value: String(lostFiltered.length),
            color: "#7c3aed",
            sub: "con presencia Abbott en últimos 7 días",
          },
          {
            label: "Ganó BuyBox hoy",
            value: String(lostWins),
            color: "#16a34a",
            sub: "Abbott es el winner en último día",
          },
          {
            label: "Perdió BuyBox hoy",
            value: String(lostLoses),
            color: "#dc2626",
            sub: "presente pero no gana en último día",
          },
          {
            label: "Win Rate (7d)",
            value: `${lostWinRate}%`,
            color: lostWinRate >= 50 ? "#16a34a" : lostWinRate >= 30 ? "#d97706" : "#dc2626",
            sub: "sobre productos donde Abbott compite",
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
              {lostFiltered.length} productos
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
        ) : lostFiltered.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm">Sin productos de Abbott en los últimos 7 días</div>
        ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Producto</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Estado hoy</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">BuyBox Winner</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">P. Winner</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">P. Abbott hoy</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Diferencia</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lostFiltered.map((e, i) => {
                    const diff = e.newsan_price != null && !e.newsan_wins
                      ? Math.round(((e.newsan_price - e.winner_price) / e.winner_price) * 100)
                      : null
                    return (
                      <tr key={`${e.id}-${i}`}
                        className={clsx("transition-colors",
                          e.newsan_wins ? "bg-green-50/40 hover:bg-green-50" : "hover:bg-gray-50"
                        )}>
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
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {e.newsan_wins ? (
                            <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">✓ Ganó BuyBox</span>
                          ) : e.newsan_price != null ? (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">✗ Perdió BuyBox</span>
                          ) : (
                            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">sin Abbott</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {e.newsan_wins ? (
                            <span className="flex items-center gap-1 text-[10px] font-black text-green-700"><Trophy size={9} className="text-amber-500" />Abbott</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">{e.winner_seller}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="font-black text-gray-900 font-mono">{fmtPrice(e.winner_price, country)}</div>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {e.newsan_wins ? (
                            <span className="text-gray-300 text-[10px]">= winner</span>
                          ) : e.newsan_price != null ? (
                            <div className="font-mono text-gray-700">{fmtPrice(e.newsan_price, country)}</div>
                          ) : (
                            <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">—</span>
                          )}
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
        )}
      </div>
    </div>
  )
}
