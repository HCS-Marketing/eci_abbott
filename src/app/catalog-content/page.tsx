"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useMarket } from "@/lib/use-market"
import { useGlobalFilters } from "@/lib/filter-context"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import clsx from "clsx"
import { AlertTriangle, Search, Download, FileText, Star, ShoppingCart } from "lucide-react"
import { downloadCSV, exportPDF } from "@/lib/export"

interface CatalogRow {
  titulo: string
  skuid: string
  plataforma: string
  fabricante: string
  valoracion: number
  ventas: number
  score: number
  rank: number
}

type ViewMode = "list" | "planogram"
type SortBy = "score" | "valoracion" | "ventas" | "titulo"
type SortDir = "asc" | "desc"

export default function CatalogContentPage() {
  useMarket()
  const { country } = useGlobalFilters()
  const isMexico = country === "MX"

  const [channel, setChannel] = useState("")
  const [category, setCategory] = useState("")
  const [segmento, setSegmento] = useState("")
  const [mercado, setMercado] = useState("")
  const [date, setDate] = useState("")
  const [minDate, setMinDate] = useState("")
  const [maxDate, setMaxDate] = useState("")
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [sortBy, setSortBy] = useState<SortBy>("score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [topN, setTopN] = useState(200)
  const [selectedSeller, setSelectedSeller] = useState("ABBOTT")

  const [availableSegmentos, setAvailableSegmentos] = useState<string[]>([])
  const [availableMercados, setAvailableMercados] = useState<string[]>([])
  const [availableChannels, setAvailableChannels] = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [availableSellers, setAvailableSellers] = useState<string[]>([])
  const [data, setData] = useState<CatalogRow[]>([])
  const [loading, setLoading] = useState(false)

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
  }, [channel, country, mercado, segmento])

  useEffect(() => {
    const p = new URLSearchParams({ action: "mercados" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    if (segmento) p.set("segmento", segmento)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableMercados(d)
      if (mercado && !d.includes(mercado)) setMercado("")
    })
  }, [channel, country, segmento, mercado])

  useEffect(() => {
    const p = new URLSearchParams({ action: "dates" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: { min: string; max: string }) => {
      if (!d?.max) return
      setMinDate(d.min)
      setMaxDate(d.max)
      setDate(prev => (!prev || prev > d.max || prev < d.min) ? d.max : prev)
    })
  }, [channel, country])

  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    if (category) p.set("category", category)
    if (country) p.set("country", country)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      const allowed = d.filter(c => /amazon|mercado.?libre|^ml$/i.test(c))
      setAvailableChannels(allowed)
      if (channel && !allowed.includes(channel)) setChannel("")
    })
  }, [category, country, channel])

  useEffect(() => {
    const p = new URLSearchParams({ action: "categories" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableCategories(d)
      if (category && !d.includes(category)) setCategory("")
    })
  }, [channel, country, category])

  useEffect(() => {
    const p = new URLSearchParams({ action: "fabricantes_inv" })
    if (country) p.set("country", country)
    if (channel) p.set("channel", channel)
    if (category) p.set("category", category)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableSellers(d)
      if (d.includes("ABBOTT") && !selectedSeller) setSelectedSeller("ABBOTT")
      else if (selectedSeller && !d.includes(selectedSeller)) setSelectedSeller(d.includes("ABBOTT") ? "ABBOTT" : "")
    })
  }, [country, channel, category, selectedSeller])

  const fetchData = useCallback(() => {
    if (!date) return
    setLoading(true)
    const p = new URLSearchParams({
      action: "catalog_content",
      date,
      sortBy,
      sortDir,
      limit: String(topN),
    })
    if (channel) p.set("channel", channel)
    if (category) p.set("category", category)
    if (country) p.set("country", country)
    if (selectedSeller) p.set("seller", selectedSeller)
    if (segmento) p.set("segmento", segmento)
    if (mercado) p.set("mercado", mercado)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [date, sortBy, sortDir, topN, channel, category, country, selectedSeller, segmento, mercado])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() =>
    data.filter(e =>
      !search ||
      e.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      e.skuid?.toLowerCase().includes(search.toLowerCase())
    )
  , [data, search])

  const avgRating = filtered.length ? (filtered.reduce((s, e) => s + e.valoracion, 0) / filtered.length) : 0
  const totalSales = filtered.reduce((s, e) => s + e.ventas, 0)

  if (!isMexico) {
    return (
      <div className="space-y-4">
        <PageHeader title="Contenido de catalogo" subtitle="Disponible solo para México" />
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 mt-0.5" size={18} />
            <div>
              <div className="text-sm font-semibold text-amber-800">Módulo en construcción para este país</div>
              <p className="text-xs text-amber-700 mt-1">
                Este módulo solo está habilitado para México. Para otros países se encuentra en construcción.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contenido de catalogo"
        subtitle="Calidad de catálogo por producto en Amazon y Mercado Libre"
      />

      <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fecha</span>
          <DateInput value={date} min={minDate} max={maxDate} onChange={setDate} />
        </div>
        {maxDate && <span className="text-[10px] text-green-600 font-semibold">Última actualización BD: {maxDate}</span>}

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Mercado</span>
          <select value={mercado} onChange={e => { setMercado(e.target.value); if (!e.target.value) setSegmento("") }}
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Canal</span>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Amazon + Mercado Libre</option>
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fabricante</span>
          <select value={selectedSeller} onChange={e => setSelectedSeller(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white min-w-[140px]">
            <option value="">Todos</option>
            {availableSellers.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Orden</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="score">Puntaje</option>
            <option value="valoracion">Valoración</option>
            <option value="ventas">Ventas</option>
            <option value="titulo">Título</option>
          </select>
          <select value={sortDir} onChange={e => setSortDir(e.target.value as SortDir)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </div>

        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {[100, 200, 500].map(n => (
            <button key={n} onClick={() => setTopN(n)}
              className={clsx("px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                topN === n ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
              Top {n}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          <button onClick={() => setViewMode("list")}
            className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
              viewMode === "list" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
            Lista
          </button>
          <button onClick={() => setViewMode("planogram")}
            className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
              viewMode === "planogram" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
            Planograma
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => downloadCSV(filtered as unknown as Record<string, unknown>[], "catalog-content")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 transition-colors" title="Descargar CSV">
            <Download size={12} /><span>CSV</span>
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 transition-colors" title="Exportar PDF">
            <FileText size={12} /><span>PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Productos", value: String(filtered.length), color: "#7c3aed", sub: "universo filtrado" },
          { label: "Valoración promedio", value: avgRating.toFixed(2), color: "#d97706", sub: "escala 0-5" },
          { label: "Ventas acumuladas", value: totalSales.toLocaleString("es-MX"), color: "#16a34a", sub: "normalizadas" },
          { label: "Top score", value: filtered[0] ? `${filtered[0].score.toFixed(2)}` : "0", color: "#2563eb", sub: "mejor producto" },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400">
              {category || "Todas las categorías"} · {channel || "Amazon + Mercado Libre"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{filtered.length} productos</div>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
            <Search size={12} className="text-gray-400" />
            <input type="text" placeholder="Buscar título o SKUID..." value={search}
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
        ) : viewMode === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Puesto</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Titulo</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Skuid</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Valoración</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Ventas</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Puntaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e, i) => (
                  <tr key={`${e.skuid}-${e.plataforma}-${i}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">#{e.rank}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-md">
                      <div className="font-medium text-gray-800 truncate">{e.titulo}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[10px] font-mono text-gray-600">{e.skuid}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full border border-indigo-100">{e.plataforma}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-gray-700 font-semibold"><Star size={11} className="text-amber-500" />{e.valoracion.toFixed(1)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{e.ventas.toLocaleString("es-MX")}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-purple-700">{e.score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((e, i) => (
              <div key={`${e.skuid}-${e.plataforma}-${i}`} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">#{e.rank}</span>
                  <span className="text-[10px] text-gray-500">{e.plataforma}</span>
                </div>
                <div className="text-xs font-semibold text-gray-800 line-clamp-2 min-h-[32px]">{e.titulo}</div>
                <div className="text-[10px] font-mono text-gray-500 mt-1 truncate">{e.skuid}</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-2 text-center">
                    <div className="text-[9px] text-amber-700">Rating</div>
                    <div className="text-xs font-bold text-amber-800">{e.valoracion.toFixed(1)}</div>
                  </div>
                  <div className="rounded-lg bg-green-50 border border-green-100 p-2 text-center">
                    <div className="text-[9px] text-green-700">Ventas</div>
                    <div className="text-xs font-bold text-green-800">{e.ventas.toLocaleString("es-MX")}</div>
                  </div>
                  <div className="rounded-lg bg-purple-50 border border-purple-100 p-2 text-center">
                    <div className="text-[9px] text-purple-700">Score</div>
                    <div className="text-xs font-bold text-purple-800">{e.score.toFixed(1)}</div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-gray-500 flex items-center gap-1">
                  <ShoppingCart size={11} />
                  Prioridad sugerida para planograma
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
