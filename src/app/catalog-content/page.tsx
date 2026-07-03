"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useMarket } from "@/lib/use-market"
import { useGlobalFilters } from "@/lib/filter-context"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import ProductMultiSelect from "@/components/ui/ProductMultiSelect"
import fallbackRows from "@/data/mx-provider-rows.json"
import { Search, Download, FileText, Star, ShoppingCart } from "lucide-react"
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

export default function CatalogContentPage() {
  useMarket()
  const { country } = useGlobalFilters()

  const [channel, setChannel] = useState("")
  const [date, setDate] = useState("")
  const [minDate, setMinDate] = useState("")
  const [maxDate, setMaxDate] = useState("")
  const [search, setSearch] = useState("")

  const [availableChannels, setAvailableChannels] = useState<string[]>([])
  const [availableProducts, setAvailableProducts] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [data, setData] = useState<CatalogRow[]>([])
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

  useEffect(() => {
    const p = new URLSearchParams({ action: "dates" })
    p.set("source", "provider")
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    fetch(`/api/provider?${p}`).then(r => r.json()).then((d: { min: string; max: string }) => {
      if (!d?.max) return
      setMinDate(d.min)
      setMaxDate(d.max)
      setDate(prev => (!prev || prev > d.max || prev < d.min) ? d.max : prev)
    })
  }, [channel, country])

  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    p.set("source", "provider")
    if (country) p.set("country", country)
    fetch(`/api/provider?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      const allowed = d.filter(c => /amazon|mercado.?libre|^ml$/i.test(c))
      setAvailableChannels(allowed)
      if (channel && !allowed.includes(channel)) setChannel("")
    })
  }, [country, channel])

  useEffect(() => {
    const p = new URLSearchParams({ action: "products" })
    if (channel) p.set("channel", channel)
    if (date) p.set("date", date)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then((d: string[]) => {
        if (!Array.isArray(d)) return
        setAvailableProducts(d)
        setSelectedProducts(prev => prev.filter(item => d.includes(item)))
      })
      .catch(() => {
        const local = Array.from(new Set((fallbackRows as Array<{ titulo: string; fecha: string; retail: string }>)
          .filter(r => (!date || r.fecha === date) && (!channel || r.retail === channel))
          .map(r => r.titulo)
          .filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"))
        setAvailableProducts(local)
        setSelectedProducts(prev => prev.filter(item => local.includes(item)))
      })
  }, [date, channel])

  const fetchData = useCallback(() => {
    setLoading(true)
    const effectiveDate = date || fallbackDateBounds.max
    const p = new URLSearchParams({
      action: "content",
      date: effectiveDate,
      limit: "5000",
    })
    p.set("source", "provider")
    if (channel) p.set("channel", channel)
    if (country) p.set("country", country)
    if (selectedProducts.length) p.set("products", selectedProducts.map(v => encodeURIComponent(v)).join(","))
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then(async d => {
        if (Array.isArray(d) && d.length > 0) {
          setData(d)
          return
        }

        const pRaw = new URLSearchParams({ action: "raw", date: effectiveDate, limit: "5000" })
        if (channel) pRaw.set("channel", channel)
        if (selectedProducts.length) pRaw.set("products", selectedProducts.map(v => encodeURIComponent(v)).join(","))
        const raw = await fetch(`/api/provider?${pRaw}`).then(r => r.json())
        if (!Array.isArray(raw) || raw.length === 0) {
          const local = (fallbackRows as Array<{ fecha: string; titulo: string; retail: string; seller: string; valoracion: number; ventas: number }>)
            .filter(r => !effectiveDate || r.fecha === effectiveDate)
            .filter(r => !channel || r.retail === channel)
            .filter(r => selectedProducts.length === 0 || selectedProducts.includes(r.titulo))
            .map((r, i) => ({
              titulo: r.titulo || "",
              skuid: `${r.retail}-${i + 1}`,
              plataforma: r.retail || "",
              fabricante: r.seller || "SIN INFORMACION",
              valoracion: Number(r.valoracion || 0),
              ventas: Number(r.ventas || 0),
              score: Number(r.ventas || 0),
              rank: i + 1,
            }))
          setData(local)
          return
        }
        setData(raw.map((r: { titulo: string; retail: string; seller: string; valoracion: number; ventas: number }, i: number) => ({
          titulo: r.titulo || "",
          skuid: `${r.retail}-${i + 1}`,
          plataforma: r.retail || "",
          fabricante: r.seller || "SIN INFORMACION",
          valoracion: Number(r.valoracion || 0),
          ventas: Number(r.ventas || 0),
          score: Number(r.ventas || 0),
          rank: i + 1,
        })))
      })
      .catch(() => {
        const local = (fallbackRows as Array<{ fecha: string; titulo: string; retail: string; seller: string; valoracion: number; ventas: number }>)
          .filter(r => !effectiveDate || r.fecha === effectiveDate)
          .filter(r => !channel || r.retail === channel)
          .filter(r => selectedProducts.length === 0 || selectedProducts.includes(r.titulo))
          .map((r, i) => ({
            titulo: r.titulo || "",
            skuid: `${r.retail}-${i + 1}`,
            plataforma: r.retail || "",
            fabricante: r.seller || "SIN INFORMACION",
            valoracion: Number(r.valoracion || 0),
            ventas: Number(r.ventas || 0),
            score: Number(r.ventas || 0),
            rank: i + 1,
          }))
        setData(local)
      })
      .finally(() => setLoading(false))
  }, [date, channel, country, fallbackDateBounds.max, selectedProducts])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() =>
    data.filter(e =>
      (selectedProducts.length === 0 || selectedProducts.includes(e.titulo)) && (
        !search ||
        e.titulo?.toLowerCase().includes(search.toLowerCase()) ||
        e.skuid?.toLowerCase().includes(search.toLowerCase())
      )
    )
  , [data, search, selectedProducts])

  const avgRating = filtered.length ? (filtered.reduce((s, e) => s + e.valoracion, 0) / filtered.length) : 0
  const totalSales = filtered.reduce((s, e) => s + e.ventas, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contenido de catalogo"
        subtitle="Calidad de catálogo por producto en Amazon y Mercado Libre"
      />

      <div className="items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl flex">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fecha</span>
          <DateInput value={date} min={minDate} max={maxDate} onChange={setDate} />
        </div>
        {maxDate && <span className="text-[10px] text-green-600 font-semibold">Última actualización BD: {maxDate}</span>}

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Canal</span>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
            <option value="">Amazon + Mercado Libre</option>
            {availableChannels.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <ProductMultiSelect
          options={availableProducts}
          selected={selectedProducts}
          onChange={setSelectedProducts}
          label="Producto"
        />

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
              {channel || "Amazon + Mercado Libre"}
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
        ) : (
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
        )}
      </div>
    </div>
  )
}
