"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useMarket } from "@/lib/use-market"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import { fmtPrice } from "@/lib/format"
import clsx from "clsx"
import { Search, CheckCircle2, XCircle, Download, FileText } from "lucide-react"
import { downloadCSV, exportPDF } from "@/lib/export"

// ─── TYPES ────────────────────────────────────────────────────
interface AssortmentRow {
  id: string; producto: string; marca: string; subcategoria: string; plataforma: string
  total_sellers: number; newsan_price: number | null
  comp_min_price: number | null; comp_max_price: number | null
  newsan_present: boolean; tier: string
}

const TIER_STYLE: Record<string, string> = {
  Premium: "text-purple-700 bg-purple-50 border-purple-200",
  Mid:     "text-blue-700 bg-blue-50 border-blue-200",
  Entry:   "text-gray-600 bg-gray-100 border-gray-300",
}

type ShowMode = "all" | "Abbott" | "gaps"

// ─── PAGE ─────────────────────────────────────────────────────
export default function AssortmentPage() {
  useMarket()

  const [channel,  setChannel]  = useState("")
  const [category, setCategory] = useState("")
  const [country,  setCountry]  = useState("")
  const [segmento, setSegmento] = useState("")
  const [mercado,  setMercado]  = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [minDate,  setMinDate]  = useState("")
  const [maxDate,  setMaxDate]  = useState("")
  const [show,     setShow]     = useState<ShowMode>("all")
  const [search,   setSearch]   = useState("")

  const [availableCountries,  setAvailableCountries]  = useState<string[]>([])
  const [availableSegmentos,  setAvailableSegmentos]  = useState<string[]>([])
  const [availableMercados,   setAvailableMercados]   = useState<string[]>([])
  const [availableChannels,   setAvailableChannels]   = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [data,    setData]    = useState<AssortmentRow[]>([])
  const [loading, setLoading] = useState(false)

  // Countries
  useEffect(() => {
    fetch('/api/sos?action=countries').then(r => r.json()).then((d: string[]) => {
      if (Array.isArray(d)) setAvailableCountries(d)
    })
  }, [])

  // Segmentos
  useEffect(() => {
    const p = new URLSearchParams({ action: "segmentos" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableSegmentos(d)
      if (segmento && !d.includes(segmento)) setSegmento("")
    })
  }, [channel, country])

  // Mercados
  useEffect(() => {
    const p = new URLSearchParams({ action: "mercados" })
    if (channel)  p.set("channel",  channel)
    if (country)  p.set("country", country)
    if (segmento) p.set("segmento", segmento)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableMercados(d)
      if (mercado && !d.includes(mercado)) setMercado("")
    })
  }, [channel, country, segmento])

  // Fecha canal-aware
  useEffect(() => {
    const p = new URLSearchParams({ action: "dates" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then((d: { min: string; max: string }) => {
        if (!d.max) return
        setMinDate(d.min); setMaxDate(d.max)
        setStartDate(prev => (!prev || prev < d.min) ? d.min : prev)
        setEndDate(prev => (!prev || prev > d.max) ? d.max : prev)
      })
  }, [channel, country])

  // Channels
  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    if (category) p.set("category", category)
    if (country)  p.set("country",  country)
    if (endDate) { p.set("startDate", startDate || endDate); p.set("endDate", endDate) }
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableChannels(d)
      if (channel && !d.includes(channel)) setChannel("")
    })
  }, [category, country, endDate])

  // Categories
  useEffect(() => {
    const p = new URLSearchParams({ action: "categories" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    if (endDate) { p.set("startDate", startDate || endDate); p.set("endDate", endDate) }
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableCategories(d)
      if (category && !d.includes(category)) setCategory("")
    })
  }, [channel, country, endDate])

  const fetchData = useCallback(() => {
    if (!endDate) return
    setLoading(true)
    const p = new URLSearchParams({ action: "assortment", date: endDate, show, limit: "500" })
    if (channel)  p.set("channel",  channel)
    if (category) p.set("category", category)
    if (country)  p.set("country",  country)
    if (segmento) p.set("segmento", segmento)
    if (mercado)  p.set("mercado",  mercado)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [channel, category, country, endDate, show, segmento, mercado])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() =>
    data.filter(e =>
      !search ||
      e.producto?.toLowerCase().includes(search.toLowerCase()) ||
      e.marca?.toLowerCase().includes(search.toLowerCase()) ||
      e.subcategoria?.toLowerCase().includes(search.toLowerCase())
    )
  , [data, search])

  // KPIs
  const totalSkus  = filtered.length
  const withNewsan = filtered.filter(e => e.newsan_present).length
  const gaps       = filtered.filter(e => !e.newsan_present).length
  const brands     = new Set(filtered.map(e => e.marca)).size
  const coverage   = totalSkus > 0 ? Math.round(withNewsan / totalSkus * 100) : 0

  // Brand summary (client-side from filtered data)
  const brandSummary = useMemo(() => {
    const map = new Map<string, { total: number; newsan: number }>()
    filtered.forEach(e => {
      const b = map.get(e.marca) || { total: 0, newsan: 0 }
      b.total++
      if (e.newsan_present) b.newsan++
      map.set(e.marca, b)
    })
    return [...map.entries()]
      .map(([marca, v]) => ({
        marca,
        total:    v.total,
        newsan:   v.newsan,
        gap:      v.total - v.newsan,
        coverage: Math.round(v.newsan / v.total * 100),
      }))
      .sort((a, b) => b.total - a.total)
  }, [filtered])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assortment"
        subtitle="Cobertura de Abbott por marca y categoría — gaps vs competencia y distribución de surtido"
      />

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl">
        {/* Fecha */}
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Canal</span>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todos los canales</option>
            {availableChannels.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Categoría</span>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todas las categorías</option>
            {availableCategories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {([
            ["all",    "Todos"],
            ["Abbott", "Con Abbott"],
            ["gaps",   "Gaps"],
          ] as const).map(([val, label]) => (
            <button key={val} onClick={() => setShow(val)}
              className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
                show === val ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => downloadCSV(data as unknown as Record<string, unknown>[], "assortment")}
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
          { label: "SKUs en mercado",   value: String(totalSkus),  color: "#7c3aed", sub: `${brands} marca${brands !== 1 ? "s" : ""}` },
          { label: "Con Abbott",        value: String(withNewsan), color: "#16a34a", sub: "Abbott presente" },
          { label: "Cobertura Abbott",  value: `${coverage}%`,     color: coverage >= 60 ? "#16a34a" : coverage >= 30 ? "#d97706" : "#dc2626", sub: "sobre SKUs totales" },
          { label: "Gaps",              value: String(gaps),       color: "#6b7280", sub: "sin Abbott" },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            {k.sub && <div className="text-xs text-gray-400 mt-1">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Cobertura por marca ──────────────────────── */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-[10px] uppercase tracking-widest text-gray-400">Cobertura por marca</div>
            <div className="text-xs text-gray-500 mt-0.5">{brandSummary.length} marcas</div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : brandSummary.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">Sin datos</div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Marca</th>
                    <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Total</th>
                    <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-green-500 font-semibold">Abbott</th>
                    <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Gap</th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-gray-400 font-semibold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {brandSummary.map(b => (
                    <tr key={b.marca} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 font-medium text-gray-700">{b.marca || "—"}</td>
                      <td className="px-2 py-2 text-center text-gray-600">{b.total}</td>
                      <td className="px-2 py-2 text-center">
                        {b.newsan > 0
                          ? <span className="font-bold text-green-600">{b.newsan}</span>
                          : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {b.gap > 0
                          ? <span className="text-amber-500 font-medium">{b.gap}</span>
                          : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={clsx("font-bold text-[10px]",
                          b.coverage >= 60 ? "text-green-600" :
                          b.coverage >= 30 ? "text-amber-500" : "text-red-500")}>
                          {b.coverage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Lista de SKUs ─────────────────────────────── */}
        <div className="lg:col-span-2 bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-400">SKUs detalle</div>
              <div className="text-xs text-gray-500 mt-0.5">{filtered.length} productos</div>
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
              <Search size={12} className="text-gray-400" />
              <input type="text" placeholder="Buscar producto, marca, categoría..." value={search}
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
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Producto</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Tier</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Fabricantes</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">P. Abbott</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Rango comp.</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Abbott</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((e, i) => (
                    <tr key={`${e.id}-${i}`}
                      className={clsx("transition-colors",
                        e.newsan_present ? "hover:bg-green-50/30" : "opacity-60 hover:opacity-80 hover:bg-gray-50")}>

                      <td className="px-4 py-2.5 max-w-[220px]">
                        <div className="font-medium text-gray-800 leading-snug truncate">{e.producto}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {e.marca       && <span className="text-[10px] text-gray-400">{e.marca}</span>}
                          {e.subcategoria && <span className="text-[10px] text-gray-400">· {e.subcategoria}</span>}
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.plataforma}</span>
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", TIER_STYLE[e.tier] ?? TIER_STYLE.Entry)}>
                          {e.tier}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-center text-gray-500">{e.total_sellers}</td>

                      <td className="px-3 py-2.5 text-right font-mono">
                        {e.newsan_price != null
                          ? <span className="text-green-700 font-bold">{fmtPrice(e.newsan_price, country)}</span>
                          : <span className="text-gray-300 text-[10px]">—</span>}
                      </td>

                      <td className="px-3 py-2.5 text-right text-gray-500">
                        {e.comp_min_price != null ? (
                          e.comp_min_price === e.comp_max_price
                            ? <span className="font-mono">{fmtPrice(e.comp_min_price, country)}</span>
                            : <span className="font-mono text-[10px]">{fmtPrice(e.comp_min_price, country)} – {fmtPrice(e.comp_max_price, country)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        {e.newsan_present
                          ? <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                          : <XCircle     size={14} className="text-gray-300 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
