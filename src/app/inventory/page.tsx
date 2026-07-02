"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useMarket } from "@/lib/use-market"
import { useGlobalFilters } from "@/lib/filter-context"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import { fmtPrice } from "@/lib/format"
import clsx from "clsx"
import { Search, AlertTriangle, CheckCircle2, Download, FileText } from "lucide-react"
import { downloadCSV, exportPDF } from "@/lib/export"

// ─── TYPES ──────────────────────────────────────────────────────────
interface InventoryRow {
  id: string; producto: string; marca: string; subcategoria: string; plataforma: string
  seller: string; precio_venta: number | null; last_seen: string | null
  days_seen: number; stock_status: "in_stock" | "break"; is_newsan: boolean
  ean: string | null; sku: string | null; meli_id: string | null; asin: string | null
}

type ShowMode = "all" | "in_stock" | "break"

// ─── PAGE ─────────────────────────────────────────────────────
export default function InventoryPage() {
  useMarket()
  const { country } = useGlobalFilters()
  const isMexico = country === "MX"

  const [channel,    setChannel]    = useState("")
  const [category,   setCategory]   = useState("")
  const [segmento,   setSegmento]   = useState("")
  const [mercado,    setMercado]    = useState("")
  const [date,      setDate]      = useState("")
  const [minDate,    setMinDate]    = useState("")
  const [maxDate,    setMaxDate]    = useState("")
  const [show,       setShow]       = useState<ShowMode>("all")
  const [limit,      setLimit]      = useState(200)
  const [search,     setSearch]     = useState("")

  const [availableSegmentos,  setAvailableSegmentos]  = useState<string[]>([])
  const [availableMercados,   setAvailableMercados]   = useState<string[]>([])
  const [availableChannels,   setAvailableChannels]   = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [data,    setData]    = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(false)

  // Countries handled by global filter context
  // Mercado / Segmento solo aplican a MX
  useEffect(() => {
    if (country !== "MX") {
      setMercado("")
      setSegmento("")
    }
    setCategory("")
    setAvailableCategories([])
  }, [country])

  // Segmentos
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
  }, [channel, country, mercado])

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
        setDate(prev => (!prev || prev > d.max || prev < d.min) ? d.max : prev)
      })
  }, [channel, country])

  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    if (category) p.set("category", category)
    if (country)  p.set("country",  country)
    if (date) p.set("endDate", date)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      const allowed = d.filter(c => /amazon|mercado.?libre/i.test(c))
      setAvailableChannels(allowed)
      if (channel && !allowed.includes(channel)) setChannel("")
    })
  }, [category, country, date])

  useEffect(() => {
    const p = new URLSearchParams({ action: "categories" })
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    if (date) p.set("endDate", date)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      setAvailableCategories(d)
      if (category && !d.includes(category)) setCategory("")
    })
  }, [channel, country, date])

  const fetchData = useCallback(() => {
    if (!date) return
    setLoading(true)
    const p = new URLSearchParams({
      action: "inventory", date, show,
      limit: String(limit),
    })
    if (channel)    p.set("channel",    channel)
    if (category)   p.set("category",   category)
    if (country)    p.set("country",    country)
    if (segmento)   p.set("segmento",   segmento)
    if (mercado)    p.set("mercado",    mercado)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [channel, category, country, date, show, limit, segmento, mercado])

  useEffect(() => { fetchData() }, [fetchData])

  if (!isMexico) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Inventario"
          subtitle="Disponible solo para México"
        />
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
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
  const amazonStock  = filtered.filter(e => e.stock_status === "in_stock" && /amazon/i.test(e.plataforma)).length
  const meliStock    = filtered.filter(e => e.stock_status === "in_stock" && /mercado.?libre/i.test(e.plataforma)).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventario"
        subtitle="Stock diario de productos de products_master en Amazon y Mercado Libre"
      />

      {/* ── Nota lógica ──────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
        <span className="font-semibold">Lógica de stock diario:</span> se toma cada producto de <span className="font-semibold">products_master</span> y se busca en <span className="font-semibold">eci.sos</span> del día. Cruce por canal: <span className="font-semibold">Amazon: skuid = asin</span> y <span className="font-semibold">Mercado Libre: meli_id = meli_id</span>. Si aparece es <span className="font-semibold">En stock</span>; si no aparece es <span className="font-semibold text-red-600">Rotura</span>.
      </div>

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl">
        {/* Fecha */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fecha</span>
          <DateInput value={date} min={minDate} max={maxDate} onChange={setDate} />
        </div>
        {maxDate && (
          <span className="text-[10px] text-green-600 font-semibold">Última actualización BD: {maxDate}</span>
        )}

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {country === "MX" && (
          <>
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
          </>
        )}

        {/* Retail */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Retail</span>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todos los retails</option>
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

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => downloadCSV(data as unknown as Record<string, unknown>[], "inventory")}
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
          { label: "En stock hoy",       value: String(inStock),      color: "#16a34a", sub: "productos activos" },
          { label: "Roturas hoy",        value: String(breaks),       color: breaks > 0 ? "#dc2626" : "#6b7280", sub: "sin match en sos" },
          { label: "Amazon en stock",    value: String(amazonStock),  color: "#16a34a", sub: "productos publicados" },
          { label: "Meli en stock",      value: String(meliStock),    color: "#16a34a", sub: "productos publicados" },
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
              {category || "Todas las categorías"} · {channel || "Todos los retails"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{filtered.length} registros del día</div>
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
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Retail</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">EAN</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">SKU</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">MLA</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Fabricante</th>
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
                        ? "bg-red-50/60 hover:bg-red-50"
                        : "bg-green-50/30 hover:bg-green-50/50"
                    )}>

                    {/* Estado */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {e.stock_status === "break" ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit text-red-700 bg-red-100 border-red-200">
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

                    {/* Retail */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.plataforma}</span>
                    </td>

                    {/* EAN / SKU / MLA */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-[10px] font-mono text-gray-600">{e.ean || "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[10px] font-mono text-gray-600">{e.sku || "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[10px] font-mono text-gray-600">{e.meli_id || "—"}</td>

                    {/* Seller */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] text-gray-600">{e.seller || "—"}</span>
                    </td>

                    {/* Precio */}
                    <td className="px-3 py-2.5 text-right font-mono">
                      {e.precio_venta != null
                        ? <span className="text-gray-800 font-semibold">{fmtPrice(e.precio_venta, country)}</span>
                        : <span className="text-gray-300 text-[10px]">—</span>}
                    </td>

                    {/* Último visto — solo para roturas */}
                    <td className="px-3 py-2.5 text-center">
                      {e.stock_status === "break" ? (
                        <span className="text-[10px] font-medium text-red-500">No visto hoy</span>
                      ) : (
                        <span className="text-[10px] font-medium text-green-600">Hoy</span>
                      )}
                    </td>

                    {/* Estado diario */}
                    <td className="px-3 py-2.5 text-center">
                      {e.stock_status === "in_stock" ? (
                        <span className="text-[10px] font-medium text-green-600">Disponible</span>
                      ) : (
                        <span className="text-[10px] font-medium text-red-500">Rotura</span>
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

