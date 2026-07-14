"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useMarket } from "@/lib/use-market"
import { useGlobalFilters } from "@/lib/filter-context"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import ProductMultiSelect from "@/components/ui/ProductMultiSelect"
import fallbackRows from "@/data/mx-provider-rows.json"
import clsx from "clsx"
import { Search, AlertTriangle, Download, FileText } from "lucide-react"
import { downloadCSV, exportPDF } from "@/lib/export"

// ─── TYPES ──────────────────────────────────────────────────────────
interface InventoryRow {
  id: string
  estado: "DISPONIBLE" | "NO DISPONIBLE" | string
  producto: string
  ean: string
  categoria: string
  canal: string
  ultimo_visto: string | null
  stock_status: "in_stock" | "break"
}

// ─── PAGE ─────────────────────────────────────────────────────
export default function InventoryPage() {
  useMarket()
  const { country } = useGlobalFilters()

  const normalizeChannel = (value: string) => {
    const v = String(value || "").trim().toUpperCase()
    if (!v) return ""
    if (v === "ML" || v.includes("MERCADO")) return "MERCADO LIBRE"
    if (v.includes("AMAZON")) return "AMAZON"
    return v
  }

  const [channel,    setChannel]    = useState("")
  const [category,   setCategory]   = useState("")
  const [date,      setDate]      = useState("")
  const [minDate,    setMinDate]    = useState("")
  const [maxDate,    setMaxDate]    = useState("")
  const [search,     setSearch]     = useState("")
  const [showOnlyUnavailable, setShowOnlyUnavailable] = useState(false)

  const [availableProducts, setAvailableProducts] = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [data,    setData]    = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(false)

  const fallbackDateBounds = useMemo(() => {
    const dates = Array.from(new Set((fallbackRows as Array<{ fecha?: string }>).map(r => r.fecha).filter(Boolean) as string[])).sort()
    return {
      min: dates[0] || "",
      max: dates[dates.length - 1] || "",
    }
  }, [])

  useEffect(() => {
    if (!date && fallbackDateBounds.max) {
      setMinDate(fallbackDateBounds.min)
      setMaxDate(fallbackDateBounds.max)
      setDate(fallbackDateBounds.max)
    }
  }, [date, fallbackDateBounds])

  // Countries handled by global filter context
  // Fecha canal-aware
  useEffect(() => {
    const p = new URLSearchParams({ action: "dates" })
    p.set("source", "provider")
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then((d: { min: string; max: string }) => {
        if (!d.max) return
        setMinDate(d.min); setMaxDate(d.max)
        setDate(d.max)
      })
  }, [channel, country])

  useEffect(() => {
    const effectiveDate = date || fallbackDateBounds.max
    const local = Array.from(new Set((fallbackRows as Array<{ titulo: string; fecha: string; retail: string; categoria?: string }>)
      .filter(r => (!effectiveDate || r.fecha === effectiveDate) && (!channel || normalizeChannel(r.retail) === channel) && (!category || String(r.categoria || "") === category))
      .map(r => r.titulo)
      .filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"))

    const p = new URLSearchParams({ action: "products" })
    if (channel) p.set("channel", channel)
    if (category) p.set("category", category)
    if (effectiveDate) p.set("date", effectiveDate)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then((d: string[]) => {
        const merged = Array.from(new Set([...(Array.isArray(d) ? d : []), ...local])).sort((a, b) => a.localeCompare(b, "es"))
        setAvailableProducts(merged)
        setSelectedProducts(prev => prev.filter(item => merged.includes(item)))
      })
      .catch(() => {
        setAvailableProducts(local)
        setSelectedProducts(prev => prev.filter(item => local.includes(item)))
      })
  }, [date, channel, category, fallbackDateBounds.max])

  useEffect(() => {
    const effectiveDate = date || fallbackDateBounds.max
    const local = Array.from(new Set((fallbackRows as Array<{ fecha: string; retail: string; categoria?: string }>)
      .filter(r => (!effectiveDate || r.fecha === effectiveDate) && (!channel || normalizeChannel(r.retail) === channel))
      .map(r => String(r.categoria || "").trim())
      .filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"))

    const p = new URLSearchParams({ action: "categories" })
    if (channel) p.set("channel", channel)
    if (effectiveDate) p.set("date", effectiveDate)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then((d: string[]) => {
        const merged = Array.from(new Set([...(Array.isArray(d) ? d : []), ...local])).sort((a, b) => a.localeCompare(b, "es"))
        setAvailableCategories(merged)
        if (category && !merged.includes(category)) setCategory("")
      })
      .catch(() => {
        setAvailableCategories(local)
        if (category && !local.includes(category)) setCategory("")
      })
  }, [date, channel, category, fallbackDateBounds.max])

  const fetchData = useCallback(() => {
    setLoading(true)
    const effectiveDate = date || fallbackDateBounds.max
    const p = new URLSearchParams({
      action: "inventory", date: effectiveDate,
      limit: "5000",
    })
    p.set("source", "provider")
    if (channel)    p.set("channel",    channel)
    if (category)   p.set("category",   category)
    if (selectedProducts.length) p.set("products", selectedProducts.map(v => encodeURIComponent(v)).join(","))
    if (country)    p.set("country",    country)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then(async d => {
        if (Array.isArray(d) && d.length > 0) {
          setData(d)
          return
        }

        const pRaw = new URLSearchParams({ action: "raw", date: effectiveDate, limit: "5000" })
        if (channel) pRaw.set("channel", channel)
        if (category) pRaw.set("category", category)
        if (selectedProducts.length) pRaw.set("products", selectedProducts.map(v => encodeURIComponent(v)).join(","))
        const raw = await fetch(`/api/provider?${pRaw}`).then(r => r.json())
        if (!Array.isArray(raw) || raw.length === 0) {
          const local = (fallbackRows as Array<{ fecha: string; retail: string; titulo: string; disponibilidad: string; EAN?: string; ean?: string; categoria?: string }>)
            .filter(r => !effectiveDate || r.fecha === effectiveDate)
            .filter(r => !channel || normalizeChannel(r.retail) === channel)
            .filter(r => !category || String(r.categoria || "") === category)
            .filter(r => selectedProducts.length === 0 || selectedProducts.includes(r.titulo))
            .map(r => {
              const status: "in_stock" | "break" = String(r.disponibilidad || "").toUpperCase().includes("NO") ? "break" : "in_stock"
              return {
                id: `${r.retail}|||${r.titulo}`,
                estado: r.disponibilidad || "NO DISPONIBLE",
                producto: r.titulo || "",
                ean: String(r.EAN || r.ean || "").trim(),
                categoria: String(r.categoria || "").trim(),
                canal: r.retail || "",
                ultimo_visto: r.fecha || null,
                stock_status: status,
              }
            })
          setData(local)
          return
        }
        setData(raw.map((r: { retail: string; titulo: string; fecha: string; disponibilidad: string; ean?: string; categoria?: string }) => ({
          id: `${r.retail}|||${r.titulo}`,
          estado: r.disponibilidad || "NO DISPONIBLE",
          producto: r.titulo || "",
          ean: String(r.ean || "").trim(),
          categoria: String(r.categoria || "").trim(),
          canal: r.retail || "",
          ultimo_visto: r.fecha || null,
          stock_status: String(r.disponibilidad || "").toUpperCase().includes("NO") ? "break" : "in_stock",
        })))
      })
      .catch(() => {
        const local = (fallbackRows as Array<{ fecha: string; retail: string; titulo: string; disponibilidad: string; EAN?: string; ean?: string; categoria?: string }>)
          .filter(r => !effectiveDate || r.fecha === effectiveDate)
          .filter(r => !channel || normalizeChannel(r.retail) === channel)
          .filter(r => !category || String(r.categoria || "") === category)
          .filter(r => selectedProducts.length === 0 || selectedProducts.includes(r.titulo))
          .map(r => {
            const status: "in_stock" | "break" = String(r.disponibilidad || "").toUpperCase().includes("NO") ? "break" : "in_stock"
            return {
              id: `${r.retail}|||${r.titulo}`,
              estado: r.disponibilidad || "NO DISPONIBLE",
              producto: r.titulo || "",
              ean: String(r.EAN || r.ean || "").trim(),
              categoria: String(r.categoria || "").trim(),
              canal: r.retail || "",
              ultimo_visto: r.fecha || null,
              stock_status: status,
            }
          })
        setData(local)
      })
      .finally(() => setLoading(false))
  }, [channel, category, country, date, fallbackDateBounds.max, selectedProducts])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() =>
    data.filter(e =>
      (!category || e.categoria === category) &&
      (!showOnlyUnavailable || e.stock_status === "break") &&
      (selectedProducts.length === 0 || selectedProducts.includes(e.producto)) && (
        !search ||
        e.producto?.toLowerCase().includes(search.toLowerCase()) ||
        e.ean?.toLowerCase().includes(search.toLowerCase()) ||
        e.categoria?.toLowerCase().includes(search.toLowerCase()) ||
        e.canal?.toLowerCase().includes(search.toLowerCase()) ||
        e.estado?.toLowerCase().includes(search.toLowerCase())
      )
    )
  , [data, search, selectedProducts, category, showOnlyUnavailable])

  // KPIs
  const inStock      = filtered.filter(e => e.stock_status === "in_stock").length
  const breaks       = filtered.filter(e => e.stock_status === "break").length
  const amazonStock  = filtered.filter(e => e.stock_status === "in_stock" && /amazon/i.test(e.canal)).length
  const meliStock    = filtered.filter(e => e.stock_status === "in_stock" && /mercado.?libre/i.test(e.canal)).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventario"
        subtitle="Estado diario de productos desde archivos base_prov (Amazon y Mercado Libre)"
      />

      {/* ── Nota lógica ──────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
        <span className="font-semibold">Lógica de inventario:</span> se unifican todos los Excel diarios de <span className="font-semibold">base_prov/amz</span> y <span className="font-semibold">base_prov/ml</span>. El estado se toma de la columna <span className="font-semibold">disponibilidad</span> y <span className="font-semibold">Ultimo visto</span> muestra la fecha más reciente con disponibilidad.
      </div>

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl flex">
        {/* Fecha */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fecha</span>
          <DateInput value={date} min={minDate} max={maxDate} onChange={setDate} />
        </div>
        {maxDate && (
          <span className="text-[10px] text-green-600 font-semibold">Última actualización BD: {maxDate}</span>
        )}

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Retail */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Retail</span>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todos</option>
            <option value="AMAZON">Amazon</option>
            <option value="MERCADO LIBRE">Mercado Libre</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Categoría</span>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Todas</option>
            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowOnlyUnavailable(prev => !prev)}
          className={clsx(
            "text-xs px-3 py-1.5 rounded-lg border transition-colors",
            showOnlyUnavailable
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          )}
        >
          Solo no disponibles
        </button>

        <ProductMultiSelect
          options={availableProducts}
          selected={selectedProducts}
          onChange={setSelectedProducts}
          label="Producto"
        />

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
              {channel || "Todos"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{filtered.length} productos</div>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
            <Search size={12} className="text-gray-400" />
            <input type="text" placeholder="Buscar producto, canal o estado..." value={search}
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
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">EAN</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Categoría</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-center">Ultimo visto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e, i) => (
                  <tr key={`${e.id}-${i}`}
                    className={clsx("transition-colors",
                      e.stock_status === "break"
                        ? "bg-red-50/60 hover:bg-red-50"
                        : "bg-green-50/30 hover:bg-green-50/50"
                    )}>

                    {/* Estado */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {e.estado === "NO DISPONIBLE" ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit text-red-700 bg-red-100 border-red-200">
                          <AlertTriangle size={9} />No disponible
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full w-fit">
                          Disponible
                        </span>
                      )}
                    </td>

                    {/* Producto */}
                    <td className="px-3 py-2.5 max-w-xs">
                      <div className="font-medium text-gray-800 leading-snug truncate">{e.producto}</div>
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-gray-700">
                      {e.ean || "-"}
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                      {e.categoria || "-"}
                    </td>

                    {/* Canal */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.canal}</span>
                    </td>

                    {/* Ultimo visto */}
                    <td className="px-3 py-2.5 text-center">
                      {e.ultimo_visto ? (
                        <span className="text-[10px] font-medium text-gray-700">{e.ultimo_visto}</span>
                      ) : (
                        <span className="text-[10px] font-medium text-gray-400">—</span>
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

