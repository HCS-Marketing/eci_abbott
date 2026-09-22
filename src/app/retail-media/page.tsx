"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, Download, FileText, Search } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import { useGlobalFilters } from "@/lib/filter-context"
import { downloadCSV, exportPDF } from "@/lib/export"

interface RetailMediaRow {
  fuente: "sos" | "search"
  formato: string
  fecha: string
  retail: string
  categoria_col: string | null
  subcategoria_col: string | null
  titulo: string | null
  marca: string | null
  fabricante: string
  orden: number | null
  promocionado: boolean
}

interface SummaryRow {
  total_promocionados?: number
  abbott_promocionados?: number
  competencia_promocionados?: number
  retailers?: number
  categorias?: number
  orden_promedio?: number | null
}

interface GroupRow {
  retail?: string
  formato?: string
  fuente?: string
  fabricante?: string
  marca?: string | null
  total: number
  abbott?: number
  competencia?: number
  orden_promedio?: number | null
}

interface SummaryResponse {
  totals: SummaryRow
  byRetail: GroupRow[]
  byFormat: GroupRow[]
  competitors: GroupRow[]
}

function fmtNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-"
  return Number(value).toLocaleString("es-MX")
}

function fmtOrder(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-"
  return Number(value).toFixed(1)
}

export default function RetailMediaPage() {
  const { country } = useGlobalFilters()
  const isColombia = country === "CO"

  const [channel, setChannel] = useState("")
  const [category, setCategory] = useState("")
  const [source, setSource] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [minDate, setMinDate] = useState("")
  const [maxDate, setMaxDate] = useState("")
  const [search, setSearch] = useState("")

  const [availableChannels, setAvailableChannels] = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [summary, setSummary] = useState<SummaryResponse>({ totals: {}, byRetail: [], byFormat: [], competitors: [] })
  const [rows, setRows] = useState<RetailMediaRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isColombia) {
      setChannel("")
      setCategory("")
      setRows([])
      setSummary({ totals: {}, byRetail: [], byFormat: [], competitors: [] })
    }
  }, [isColombia])

  useEffect(() => {
    if (!isColombia) return
    fetch(`/api/retail-media?action=dates&country=CO`)
      .then(r => r.json())
      .then((d: { min: string; max: string }) => {
        if (!d.max) return
        setMinDate(d.min)
        setMaxDate(d.max)
        setStartDate(d.max)
        setEndDate(d.max)
      })
  }, [isColombia])

  useEffect(() => {
    if (!isColombia) return
    const p = new URLSearchParams({ action: "channels", country: "CO" })
    if (startDate) p.set("startDate", startDate)
    if (endDate) p.set("endDate", endDate)
    fetch(`/api/retail-media?${p}`)
      .then(r => r.json())
      .then((d: string[]) => {
        const channels = Array.isArray(d) ? d : []
        setAvailableChannels(channels)
        if (channel && !channels.includes(channel)) setChannel("")
      })
  }, [isColombia, startDate, endDate, channel])

  useEffect(() => {
    if (!isColombia) return
    const p = new URLSearchParams({ action: "categories", country: "CO" })
    if (startDate) p.set("startDate", startDate)
    if (endDate) p.set("endDate", endDate)
    if (channel) p.set("channel", channel)
    fetch(`/api/retail-media?${p}`)
      .then(r => r.json())
      .then((d: string[]) => {
        const categories = Array.isArray(d) ? d : []
        setAvailableCategories(categories)
        if (category && !categories.includes(category)) setCategory("")
      })
  }, [isColombia, startDate, endDate, channel, category])

  const fetchData = useCallback(() => {
    if (!isColombia || !endDate) return
    setLoading(true)
    const base = new URLSearchParams({ country: "CO", startDate, endDate })
    if (channel) base.set("channel", channel)
    if (category) base.set("category", category)
    if (source) base.set("source", source)

    const summaryParams = new URLSearchParams(base)
    summaryParams.set("action", "summary")
    const rowParams = new URLSearchParams(base)
    rowParams.set("action", "rows")
    rowParams.set("limit", "1000")

    Promise.all([
      fetch(`/api/retail-media?${summaryParams}`).then(r => r.json()),
      fetch(`/api/retail-media?${rowParams}`).then(r => r.json()),
    ])
      .then(([summaryData, rowData]) => {
        setSummary(summaryData?.totals ? summaryData : { totals: {}, byRetail: [], byFormat: [], competitors: [] })
        setRows(Array.isArray(rowData) ? rowData : [])
      })
      .finally(() => setLoading(false))
  }, [isColombia, startDate, endDate, channel, category, source])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row =>
      String(row.titulo || "").toLowerCase().includes(q) ||
      String(row.marca || "").toLowerCase().includes(q) ||
      String(row.fabricante || "").toLowerCase().includes(q) ||
      String(row.categoria_col || "").toLowerCase().includes(q) ||
      String(row.retail || "").toLowerCase().includes(q)
    )
  }, [rows, search])

  if (!isColombia) {
    return (
      <div className="space-y-4">
        <PageHeader title="Retail Media" subtitle="Módulo disponible solo para Colombia" />
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Selecciona Colombia para ver datos de Retail Media.
        </div>
      </div>
    )
  }

  const totals = summary.totals || {}

  return (
    <div className="space-y-4">
      <PageHeader title="Retail Media" subtitle="Productos promocionados, posición y formatos por retailer en Colombia" />

      <div className="items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl flex">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Desde</span>
          <DateInput value={startDate} min={minDate} max={maxDate} onChange={setStartDate} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Hasta</span>
          <DateInput value={endDate} min={minDate} max={maxDate} onChange={setEndDate} />
        </div>
        <div className="w-px h-5 bg-gray-200 hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Retail</span>
          <select value={channel} onChange={e => setChannel(e.target.value)} className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todos</option>
            {availableChannels.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Categoría</span>
          <select value={category} onChange={e => setCategory(e.target.value)} className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todas</option>
            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Formato</span>
          <select value={source} onChange={e => setSource(e.target.value)} className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="all">Todos</option>
            <option value="sos">PLP categorías</option>
            <option value="search">Sponsored search</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => downloadCSV(filteredRows as unknown as Record<string, unknown>[], "retail-media")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 transition-colors" title="Descargar CSV">
            <Download size={12} /><span>CSV</span>
          </button>
          <button onClick={exportPDF} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 transition-colors" title="Exportar PDF">
            <FileText size={12} /><span>PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: "Promocionados", value: fmtNumber(totals.total_promocionados), color: "#7c3aed", sub: "solo true" },
          { label: "Abbott", value: fmtNumber(totals.abbott_promocionados), color: "#2563eb", sub: "promocionados" },
          { label: "Competencia", value: fmtNumber(totals.competencia_promocionados), color: "#dc2626", sub: "promocionados" },
          { label: "Retails", value: fmtNumber(totals.retailers), color: "#0891b2", sub: "con pauta" },
          { label: "Categorías", value: fmtNumber(totals.categorias), color: "#16a34a", sub: "con pauta" },
          { label: "Orden prom.", value: fmtOrder(totals.orden_promedio), color: "#ea580c", sub: "posición" },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-800">Retailers</div>
          <div className="divide-y divide-gray-50">
            {summary.byRetail.map(row => (
              <div key={row.retail} className="px-4 py-3 text-xs flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-800">{row.retail}</div>
                  <div className="text-gray-400">Abbott {fmtNumber(row.abbott)} · Competencia {fmtNumber(row.competencia)}</div>
                </div>
                <div className="text-right"><div className="font-bold text-purple-700">{fmtNumber(row.total)}</div><div className="text-gray-400">orden {fmtOrder(row.orden_promedio)}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-800">Formatos</div>
          <div className="divide-y divide-gray-50">
            {summary.byFormat.map(row => (
              <div key={`${row.fuente}-${row.formato}`} className="px-4 py-3 text-xs flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-800">{row.formato}</div>
                  <div className="text-gray-400">{row.fuente === "search" ? "Search" : "SOS / categoría"}</div>
                </div>
                <div className="text-right"><div className="font-bold text-sky-700">{fmtNumber(row.total)}</div><div className="text-gray-400">orden {fmtOrder(row.orden_promedio)}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-800">Competencia</div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-auto">
            {summary.competitors.map((row, idx) => (
              <div key={`${row.fabricante}-${row.marca}-${idx}`} className="px-4 py-3 text-xs flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800 truncate">{row.fabricante}</div>
                  <div className="text-gray-400 truncate">{row.marca || "Sin marca"}</div>
                </div>
                <div className="text-right"><div className="font-bold text-red-700">{fmtNumber(row.total)}</div><div className="text-gray-400">orden {fmtOrder(row.orden_promedio)}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400">Promocionados true</div>
            <div className="text-xs text-gray-500 mt-0.5">{filteredRows.length} registros</div>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
            <Search size={12} className="text-gray-400" />
            <input type="text" placeholder="Buscar título, marca, fabricante, categoría..." value={search} onChange={e => setSearch(e.target.value)} className="text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-400 w-72" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm">Sin productos promocionados para los filtros seleccionados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Fecha</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Retail</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Formato</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Orden</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Título</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Marca</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Fabricante</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Categoría</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Subcategoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRows.map((row, idx) => (
                  <tr key={`${row.fuente}-${row.retail}-${row.titulo}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{String(row.fecha).slice(0, 10)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full border border-indigo-100">{row.retail}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{row.formato}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-purple-700">{fmtOrder(row.orden)}</td>
                    <td className="px-3 py-2.5 max-w-sm"><div className="font-medium text-gray-800 truncate">{row.titulo || "-"}</div></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{row.marca || "-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className={row.fabricante === "ABBOTT" ? "text-blue-700 font-bold" : "text-gray-700"}>{row.fabricante}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{row.categoria_col || "-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{row.subcategoria_col || "-"}</td>
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
