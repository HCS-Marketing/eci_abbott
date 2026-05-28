"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useMarket } from "@/lib/use-market"
import PageHeader from "@/components/ui/PageHeader"
import clsx from "clsx"
import { Search, AlertTriangle, CheckCircle2, Clock } from "lucide-react"

// ─── TYPES ────────────────────────────────────────────────────
interface InventoryRow {
  id: string; producto: string; marca: string; subcategoria: string; plataforma: string
  seller: string; precio_venta: number | null; last_seen: string | null
  days_seen: number; stock_status: "in_stock" | "break"; is_newsan: boolean
}

function fmtARS(n: number | null) {
  if (n == null || n === 0) return "—"
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

function relDate(dateStr: string | null, baseDate: string): string {
  if (!dateStr) return "—"
  const a = new Date(baseDate.split("T")[0]    + "T12:00:00")
  const b = new Date(dateStr.split("T")[0]     + "T12:00:00")
  const diff = Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return "Hoy"
  if (diff === 1) return "Ayer"
  return `Hace ${diff} días`
}

type ShowMode = "all" | "in_stock" | "break"

// ─── PAGE ─────────────────────────────────────────────────────
export default function InventoryPage() {
  useMarket()

  const [channel,    setChannel]    = useState("")
  const [category,   setCategory]   = useState("")
  const [date,       setDate]       = useState("")
  const [minDate,    setMinDate]    = useState("")
  const [maxDate,    setMaxDate]    = useState("")
  const [show,       setShow]       = useState<ShowMode>("all")
  const [lookback,   setLookback]   = useState(7)
  const [onlyNewsan, setOnlyNewsan] = useState(false)
  const [limit,      setLimit]      = useState(200)
  const [search,     setSearch]     = useState("")

  const [availableChannels,   setAvailableChannels]   = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [data,    setData]    = useState<InventoryRow[]>([])
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

  const fetchData = useCallback(() => {
    if (!date) return
    setLoading(true)
    const p = new URLSearchParams({
      action: "inventory", date, show,
      lookback: String(lookback), limit: String(limit),
    })
    if (channel)    p.set("channel",    channel)
    if (category)   p.set("category",   category)
    if (onlyNewsan) p.set("onlyNewsan", "1")
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [channel, category, date, show, lookback, onlyNewsan, limit])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() =>
    data.filter(e =>
      !search ||
      e.producto?.toLowerCase().includes(search.toLowerCase()) ||
      e.seller?.toLowerCase().includes(search.toLowerCase()) ||
      e.marca?.toLowerCase().includes(search.toLowerCase()) ||
      e.subcategoria?.toLowerCase().includes(search.toLowerCase())
    )
  , [data, search])

  // KPIs
  const inStock      = filtered.filter(e => e.stock_status === "in_stock").length
  const breaks       = filtered.filter(e => e.stock_status === "break").length
  const newsanStock  = filtered.filter(e => e.is_newsan && e.stock_status === "in_stock").length
  const newsanBreaks = filtered.filter(e => e.is_newsan && e.stock_status === "break").length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventario"
        subtitle={`Presencia de productos en el mercado — stock activo y roturas detectadas en ventana de ${lookback} días`}
      />

      {/* ── Nota lógica ──────────────────────────────── */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Clock size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700">
          <span className="font-semibold">Lógica de stock:</span> Si un producto aparece hoy →{" "}
          <span className="font-semibold">En stock</span>. Si apareció en los últimos{" "}
          <span className="font-semibold">{lookback} días</span> pero no hoy →{" "}
          <span className="font-semibold text-red-600">Rotura de stock</span>.
        </div>
      </div>

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

        {/* Ventana lookback */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Ventana</span>
          <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
            {[3, 7, 14].map(n => (
              <button key={n} onClick={() => setLookback(n)}
                className={clsx("px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  lookback === n ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
                {n}d
              </button>
            ))}
          </div>
        </div>

        {/* Show toggle */}
        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {([
            ["all",      "Todos"],
            ["in_stock", "En stock"],
            ["break",    "Roturas"],
          ] as const).map(([val, label]) => (
            <button key={val} onClick={() => setShow(val)}
              className={clsx("px-3 py-1 rounded-md text-xs font-medium transition-all",
                show === val ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
              {label}
            </button>
          ))}
        </div>

        {/* Solo Abbott */}
        <button onClick={() => setOnlyNewsan(v => !v)}
          className={clsx("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
            onlyNewsan
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600")}>
          Solo Abbott
        </button>

        {/* Límite */}
        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {[100, 200, 500].map(n => (
            <button key={n} onClick={() => setLimit(n)}
              className={clsx("px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                limit === n ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700")}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "En stock hoy",       value: String(inStock),      color: "#16a34a", sub: "productos activos" },
          { label: "Roturas detectadas", value: String(breaks),       color: breaks > 0 ? "#dc2626" : "#6b7280", sub: `ausentes en últimos ${lookback}d` },
          { label: "Abbott en stock",    value: String(newsanStock),  color: "#16a34a", sub: "SKUs propios activos" },
          { label: "Roturas Abbott",     value: String(newsanBreaks), color: newsanBreaks > 0 ? "#dc2626" : "#6b7280", sub: "SKUs propios sin stock" },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
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
            <div className="text-xs text-gray-500 mt-0.5">{filtered.length} registros · ventana {lookback} días</div>
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
                  <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Estado</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Producto</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Seller</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Precio</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Último visto</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Activo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e, i) => (
                  <tr key={`${e.id}-${e.seller}-${i}`}
                    className={clsx("transition-colors",
                      e.stock_status === "break"
                        ? (e.is_newsan ? "bg-red-50/60 hover:bg-red-50" : "bg-amber-50/40 hover:bg-amber-50/70")
                        : (e.is_newsan ? "bg-green-50/30 hover:bg-green-50/50" : "hover:bg-gray-50")
                    )}>

                    {/* Estado */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {e.stock_status === "break" ? (
                        <span className={clsx("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit",
                          e.is_newsan
                            ? "text-red-700 bg-red-100 border-red-200"
                            : "text-amber-700 bg-amber-50 border-amber-200")}>
                          <AlertTriangle size={9} />Rotura
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full w-fit">
                          <CheckCircle2 size={9} />En stock
                        </span>
                      )}
                    </td>

                    {/* Producto */}
                    <td className="px-3 py-2.5 max-w-xs">
                      <div className="font-medium text-gray-800 leading-snug truncate">{e.producto}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {e.marca       && <span className="text-[10px] text-gray-400">{e.marca}</span>}
                        {e.subcategoria && <span className="text-[10px] text-gray-400">· {e.subcategoria}</span>}
                      </div>
                    </td>

                    {/* Canal */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.plataforma}</span>
                    </td>

                    {/* Seller */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {e.is_newsan ? (
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">Abbott</span>
                      ) : (
                        <span className="text-[10px] text-gray-600">{e.seller}</span>
                      )}
                    </td>

                    {/* Precio */}
                    <td className="px-3 py-2.5 text-right font-mono">
                      {e.precio_venta != null
                        ? <span className="text-gray-800 font-semibold">{fmtARS(e.precio_venta)}</span>
                        : <span className="text-gray-300 text-[10px]">—</span>}
                    </td>

                    {/* Último visto — solo para roturas */}
                    <td className="px-3 py-2.5 text-center">
                      {e.stock_status === "break" ? (
                        <span className={clsx("text-[10px] font-medium",
                          e.is_newsan ? "text-red-500" : "text-amber-600")}>
                          {relDate(e.last_seen, date)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[10px]">—</span>
                      )}
                    </td>

                    {/* Activo en ventana — solo para in_stock */}
                    <td className="px-3 py-2.5 text-center">
                      {e.stock_status === "in_stock" ? (
                        <span className={clsx("text-[10px] font-medium",
                          e.days_seen === 0 ? "text-blue-500" : "text-gray-500")}>
                          {e.days_seen === 0 ? "Nuevo" : `${e.days_seen}/${lookback}d`}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[10px]">—</span>
                      )}
                    </td>
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

