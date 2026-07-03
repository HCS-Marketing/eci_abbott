"use client"
import { useState, useEffect, useCallback } from "react"
import { useMarket } from "@/lib/use-market"
import { useGlobalFilters } from "@/lib/filter-context"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import ProductMultiSelect from "@/components/ui/ProductMultiSelect"
import fallbackRows from "@/data/mx-provider-rows.json"
import { Search, Download, FileText } from "lucide-react"
import { downloadCSV, exportPDF } from "@/lib/export"

// ─── TYPES ────────────────────────────────────────────────────
interface BuyboxLostRow {
  id: string
  producto: string
  plataforma: string
  estado_hoy: string
  winner_seller: string
}

// ─── PAGE ─────────────────────────────────────────────────────
export default function BuyboxPage() {
  useMarket()
  const { country } = useGlobalFilters()

  const normalizeChannel = (value: string) => {
    const v = String(value || "").trim().toUpperCase()
    if (!v) return ""
    if (v === "ML" || v.includes("MERCADO")) return "MERCADO LIBRE"
    if (v.includes("AMAZON")) return "AMAZON"
    return v
  }

  const [channel,  setChannel]  = useState("")
  const [date,     setDate]     = useState("")
  const [minDate,  setMinDate]  = useState("")
  const [maxDate,  setMaxDate]  = useState("")
  const [search,   setSearch]   = useState("")

  const [availableProducts, setAvailableProducts] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [lostData, setLostData] = useState<BuyboxLostRow[]>([])
  const [loading,  setLoading]  = useState(false)

  const fallbackDateBounds = useState(() => {
    const dates = Array.from(new Set((fallbackRows as Array<{ fecha?: string }>).map(r => r.fecha).filter(Boolean) as string[])).sort()
    return {
      min: dates[0] || "",
      max: dates[dates.length - 1] || "",
    }
  })[0]

  useEffect(() => {
    if (!date && fallbackDateBounds.max) {
      setMinDate(fallbackDateBounds.min)
      setMaxDate(fallbackDateBounds.max)
      setDate(fallbackDateBounds.max)
    }
  }, [date, fallbackDateBounds])

  // Countries handled by global filter context

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
    const effectiveDate = date || fallbackDateBounds.max
    const local = Array.from(new Set((fallbackRows as Array<{ titulo: string; fecha: string; retail: string }>)
      .filter(r => (!effectiveDate || r.fecha === effectiveDate) && (!channel || normalizeChannel(r.retail) === channel))
      .map(r => r.titulo)
      .filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"))

    const p = new URLSearchParams({ action: "products" })
    if (channel) p.set("channel", channel)
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
  }, [date, channel, fallbackDateBounds.max])

  // Fetch buybox Newsan 7d
  const fetchData = useCallback(() => {
    setLoading(true)
    const effectiveDate = date || fallbackDateBounds.max
    const p = new URLSearchParams({ action: "buybox", limit: "5000" })
    p.set("source", "provider")
    p.set("date", effectiveDate)
    if (channel)  p.set("channel",  channel)
    if (selectedProducts.length) p.set("products", selectedProducts.map(v => encodeURIComponent(v)).join(","))
    if (country)  p.set("country",  country)
    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then(async d => {
        if (Array.isArray(d) && d.length > 0) {
          setLostData(d)
          return
        }

        const pRaw = new URLSearchParams({ action: "raw", date: effectiveDate, limit: "5000" })
        if (channel) pRaw.set("channel", channel)
        if (selectedProducts.length) pRaw.set("products", selectedProducts.map(v => encodeURIComponent(v)).join(","))
        const raw = await fetch(`/api/provider?${pRaw}`).then(r => r.json())
        if (!Array.isArray(raw) || raw.length === 0) {
          const local = (fallbackRows as Array<{ fecha: string; retail: string; titulo: string; disponibilidad: string; seller: string }>)
            .filter(r => !effectiveDate || r.fecha === effectiveDate)
            .filter(r => !channel || normalizeChannel(r.retail) === channel)
            .filter(r => selectedProducts.length === 0 || selectedProducts.includes(r.titulo))
            .map((r, i) => ({
              id: `${r.retail}|||${r.titulo}|||${i}`,
              producto: r.titulo || "",
              plataforma: r.retail || "",
              estado_hoy: r.disponibilidad || "NO DISPONIBLE",
              winner_seller: r.seller || "SIN INFORMACION",
            }))
          setLostData(local)
          return
        }
        setLostData(raw.map((r: { retail: string; titulo: string; disponibilidad: string; seller: string }, i: number) => ({
          id: `${r.retail}|||${r.titulo}|||${i}`,
          producto: r.titulo || "",
          plataforma: r.retail || "",
          estado_hoy: r.disponibilidad || "NO DISPONIBLE",
          winner_seller: r.seller || "SIN INFORMACION",
        })))
      })
      .catch(() => {
        const local = (fallbackRows as Array<{ fecha: string; retail: string; titulo: string; disponibilidad: string; seller: string }>)
          .filter(r => !effectiveDate || r.fecha === effectiveDate)
          .filter(r => !channel || normalizeChannel(r.retail) === channel)
          .filter(r => selectedProducts.length === 0 || selectedProducts.includes(r.titulo))
          .map((r, i) => ({
            id: `${r.retail}|||${r.titulo}|||${i}`,
            producto: r.titulo || "",
            plataforma: r.retail || "",
            estado_hoy: r.disponibilidad || "NO DISPONIBLE",
            winner_seller: r.seller || "SIN INFORMACION",
          }))
        setLostData(local)
      })
      .finally(() => setLoading(false))
  }, [channel, country, date, fallbackDateBounds.max, selectedProducts])

  useEffect(() => { fetchData() }, [fetchData])

  const lostFiltered = lostData.filter(e =>
    (selectedProducts.length === 0 || selectedProducts.includes(e.producto)) && (
      !search ||
      e.producto?.toLowerCase().includes(search.toLowerCase()) ||
      e.winner_seller?.toLowerCase().includes(search.toLowerCase()) ||
      e.plataforma?.toLowerCase().includes(search.toLowerCase())
    )
  )
  const availableCount = lostFiltered.filter(e => e.estado_hoy === "DISPONIBLE").length
  const unavailableCount = lostFiltered.length - availableCount

  return (
    <div className="space-y-4">
      <PageHeader
        title="BuyBox"
        subtitle="BuyBox Winner por producto desde archivos base_prov"
      />

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl flex">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fecha</span>
          <DateInput value={date} min={minDate} max={maxDate} onChange={setDate} />
        </div>
        {maxDate && <span className="text-[10px] text-green-600 font-semibold">Última fecha Excel: {maxDate}</span>}

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

        <ProductMultiSelect
          options={availableProducts}
          selected={selectedProducts}
          onChange={setSelectedProducts}
          label="Producto"
        />

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
            sub: "productos del ultimo corte",
          },
          {
            label: "Disponibles hoy",
            value: String(availableCount),
            color: "#16a34a",
            sub: "estado DISPONIBLE",
          },
          {
            label: "No disponibles hoy",
            value: String(unavailableCount),
            color: "#dc2626",
            sub: "estado NO DISPONIBLE",
          },
          {
            label: "Canales activos",
            value: String(new Set(lostFiltered.map(r => r.plataforma)).size),
            color: "#2563eb",
            sub: "Amazon / Mercado Libre",
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
              {channel || "Todos"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {lostFiltered.length} productos
            </div>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
            <Search size={12} className="text-gray-400" />
            <input type="text" placeholder="Buscar producto, canal o winner..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-400 w-52" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lostFiltered.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm">Sin productos para los filtros seleccionados</div>
        ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Producto</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Estado hoy (disponibilidad)</th>
                    <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">BuyBox Winner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lostFiltered.map((e, i) => {
                    return (
                      <tr key={`${e.id}-${i}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-medium text-gray-800 leading-snug mb-0.5">{e.producto}</div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{e.plataforma}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {e.estado_hoy === "DISPONIBLE" ? (
                            <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">DISPONIBLE</span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">NO DISPONIBLE</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">{e.winner_seller?.trim() || "sin informacion"}</span>
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
