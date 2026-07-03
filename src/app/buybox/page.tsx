"use client"
import { useState, useEffect, useCallback } from "react"
import { useMarket } from "@/lib/use-market"
import { useGlobalFilters } from "@/lib/filter-context"
import PageHeader from "@/components/ui/PageHeader"
import clsx from "clsx"
import { Search, AlertTriangle, Download, FileText } from "lucide-react"
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
  const isMexico = country === "MX"

  const [channel,  setChannel]  = useState("")
  const [segmento, setSegmento] = useState("")
  const [mercado,  setMercado]  = useState("")
  const [topN,     setTopN]     = useState(100)
  const [search,   setSearch]   = useState("")

  const [availableSegmentos,  setAvailableSegmentos]  = useState<string[]>([])
  const [availableMercados,   setAvailableMercados]   = useState<string[]>([])
  const [availableChannels,   setAvailableChannels]   = useState<string[]>([])
  const [lostData, setLostData] = useState<BuyboxLostRow[]>([])
  const [loading,  setLoading]  = useState(false)

  // Countries handled by global filter context

  // Mercado / Segmento solo aplican a MX
  useEffect(() => {
    if (country !== "MX") {
      setMercado("")
      setSegmento("")
    }
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

  // Cascading channels
  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    p.set("source", "provider")
    if (country)  p.set("country",  country)
    fetch(`/api/sos?${p}`).then(r => r.json()).then((d: string[]) => {
      if (!Array.isArray(d)) return
      const allowed = d.filter(c => /amazon|mercado.?libre/i.test(c))
      setAvailableChannels(allowed)
      if (channel && !allowed.includes(channel)) setChannel("")
    })
  }, [country])

  // Fetch buybox Newsan 7d
  const fetchData = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ action: "buybox_lost", limit: String(topN) })
    p.set("source", "provider")
    if (channel)  p.set("channel",  channel)
    if (country)  p.set("country",  country)
    if (segmento) p.set("segmento", segmento)
    if (mercado)  p.set("mercado",  mercado)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then(d => setLostData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [channel, country, topN, segmento, mercado])

  useEffect(() => { fetchData() }, [fetchData])

  if (!isMexico) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="BuyBox"
          subtitle="Disponible solo para México"
        />
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

  const lostFiltered = lostData.filter(e =>
    !search ||
    e.producto?.toLowerCase().includes(search.toLowerCase()) ||
    e.winner_seller?.toLowerCase().includes(search.toLowerCase()) ||
    e.plataforma?.toLowerCase().includes(search.toLowerCase())
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
      <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl">
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
              {channel || "Todos los retails"}
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
