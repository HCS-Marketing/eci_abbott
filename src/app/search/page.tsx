"use client"
import { useMarket } from "@/lib/use-market"
import { useGlobalFilters } from "@/lib/filter-context"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import { useState, useEffect, useCallback, useRef } from "react"
import clsx from "clsx"
import { TrendingUp, TrendingDown, Minus, Download, FileText } from "lucide-react"
import { exportPDF } from "@/lib/export"
import { getRetailColor, fmtDateDMY } from "@/lib/format"

// ── helpers ──────────────────────────────────────────────────

function Change({ val }: { val: number }) {
  if (val > 0)
    return (
      <span className="text-green-600 text-xs flex items-center gap-0.5">
        <TrendingUp size={10} />+{val}pp
      </span>
    )
  if (val < 0)
    return (
      <span className="text-red-600 text-xs flex items-center gap-0.5">
        <TrendingDown size={10} />{val}pp
      </span>
    )
  return (
    <span className="text-gray-400 text-xs flex items-center gap-0.5">
      <Minus size={10} />0
    </span>
  )
}

function SOSBar({ pct, color, max = 35 }: { pct: number; color: string; max?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, (pct / Math.max(max, 1)) * 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right font-mono">{pct}%</span>
    </div>
  )
}

function StackedBar({ data }: { data: { label: string; value: number; color: string }[] }) {
  const [tooltip, setTooltip] = useState<{ label: string; value: number; color: string; x: number } | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  return (
    <div className="relative">
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ height: 28 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {data.map(d => (
          <div
            key={d.label}
            style={{
              width: `${(d.value / total) * 100}%`,
              backgroundColor: d.color,
              minWidth: d.value > 1 ? 2 : 0,
            }}
            onMouseEnter={e => {
              const parentRect = e.currentTarget.parentElement!.getBoundingClientRect()
              const segRect = e.currentTarget.getBoundingClientRect()
              setTooltip({
                label: d.label,
                value: d.value,
                color: d.color,
                x: segRect.left - parentRect.left + segRect.width / 2,
              })
            }}
          />
        ))}
      </div>
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{ left: Math.max(0, tooltip.x - 70), top: 34 }}
        >
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-1.5 text-xs whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: tooltip.color }} />
              <span className="text-gray-700 font-medium">{tooltip.label}</span>
              <span className="font-semibold font-mono text-gray-900 ml-1">{tooltip.value}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TrendChart({
  data,
  sellers,
  colors,
}: {
  data: Record<string, unknown>[]
  sellers: string[]
  colors: Record<string, string>
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [tooltipScreenX, setTooltipScreenX] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)

  if (!data.length || !sellers.length) return null
  const W = 900, H = 220, padL = 36, padR = 12, padT = 12, padB = 24
  const allVals = data.flatMap(pt => sellers.map(s => Number(pt[s] || 0)))
  const minV = Math.max(0, Math.min(...allVals) - 2)
  const maxV = Math.max(...allVals, 1) + 2
  const x = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * (H - padT - padB)
  // Dynamic label step: show ~10-15 labels max
  const labelStep = Math.max(1, Math.ceil(data.length / 12))

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || data.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const rawIdx = ((svgX - padL) / (W - padL - padR)) * (data.length - 1)
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(rawIdx)))
    setHoveredIdx(idx)
    setTooltipScreenX(e.clientX - rect.left)
  }

  const hoveredPt = hoveredIdx !== null ? data[hoveredIdx] : null

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const yv = padT + t * (H - padT - padB)
          return (
            <g key={t}>
              <line x1={padL} y1={yv} x2={W - padR} y2={yv} stroke="#e5e7eb" strokeWidth="1" />
              <text x={padL - 4} y={yv + 3} textAnchor="end" fill="#9ca3af" fontSize="9">
                {Math.round(maxV - t * (maxV - minV))}%
              </text>
            </g>
          )
        })}
        {sellers.map(s => {
          const color = colors[s] || "#a427ff"
          const pts = data.map((pt, i) => `${x(i)},${y(Number(pt[s] || 0))}`).join(" ")
          const last = pts.split(" ").pop()?.split(",")
          return (
            <g key={s}>
              <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {last && <circle cx={last[0]} cy={last[1]} r="3" fill={color} />}
            </g>
          )
        })}
        {data
          .filter((_, i) => i % labelStep === 0)
          .map((pt, i) => (
            <text key={i} x={x(i * labelStep)} y={H - 6} textAnchor="middle" fill="#9ca3af" fontSize="8">
              {fmtDateDMY(String(pt.week))}
            </text>
          ))}
        {/* Crosshair */}
        {hoveredIdx !== null && (
          <>
            <line
              x1={x(hoveredIdx)} y1={padT}
              x2={x(hoveredIdx)} y2={H - padB}
              stroke="#6b7280" strokeWidth="1" strokeDasharray="3,2"
            />
            {sellers.map(s => (
              <circle
                key={s}
                cx={x(hoveredIdx)}
                cy={y(Number(data[hoveredIdx][s] || 0))}
                r="4"
                fill={colors[s] || "#a427ff"}
                stroke="white"
                strokeWidth="1.5"
              />
            ))}
          </>
        )}
      </svg>
      {/* Tooltip flotante */}
      {hoveredIdx !== null && hoveredPt && (
        <div
          className="absolute top-0 z-20 pointer-events-none"
          style={{
            left: tooltipScreenX > 300 ? tooltipScreenX - 150 : tooltipScreenX + 14,
            transform: "translateY(4px)",
          }}
        >
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs min-w-[140px]">
            <div className="text-[10px] text-gray-400 font-medium mb-1.5 border-b border-gray-100 pb-1">
              {fmtDateDMY(String(hoveredPt.week))}
            </div>
            {[...sellers]
              .sort((a, b) => Number(hoveredPt[b] || 0) - Number(hoveredPt[a] || 0))
              .map(s => (
                <div key={s} className="flex items-center gap-1.5 py-0.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[s] || "#a427ff" }} />
                  <span className="flex-1 text-gray-600 truncate max-w-[80px]">{s}</span>
                  <span className="font-semibold font-mono text-gray-900">{Number(hoveredPt[s] || 0)}%</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── types ──────────────────────────────────────────────────

type DrillLevel = "seller" | "brand" | "titulo"
type PageCtx    = "p1" | "total"

// ── page ──────────────────────────────────────────────────

export default function ShareOfShelfPage() {
  const market = useMarket()
  const SELLERS = market.sellers
  const COLORS  = market.colors
  const { country } = useGlobalFilters()

  // Filtros
  const [channel,    setChannel]    = useState("")
  const [category,   setCategory]   = useState("")
  const [segmento,   setSegmento]   = useState("")
  const [mercado,    setMercado]    = useState("")
  const [startDate,  setStartDate]  = useState("")
  const [endDate,    setEndDate]    = useState("")
  const [minDate,    setMinDate]    = useState("")
  const [maxDate,    setMaxDate]    = useState("")

  // Opciones dinámicas de los selects
  const [availableChannels,    setAvailableChannels]    = useState<string[]>([])
  const [availableCategories,  setAvailableCategories]  = useState<string[]>([])
  const [availableSegmentos,   setAvailableSegmentos]   = useState<string[]>([])
  const [availableMercados,    setAvailableMercados]    = useState<string[]>([])
  const [selectedSeller,  setSelectedSeller]  = useState("")
  const [selectedSellers, setSelectedSellers] = useState<string[]>([])
  const [page,  setPage]  = useState<PageCtx>("p1")
  const [drill, setDrill] = useState<DrillLevel>("seller")

  const [trendOpen, setTrendOpen] = useState(false)
  const trendRef    = useRef<HTMLDivElement>(null)
  const trendInitRef = useRef(false)
  const [visibleCount, setVisibleCount] = useState(10)

  const [sellerDropdownOpen, setSellerDropdownOpen] = useState(false)
  const [sellerSearch, setSellerSearch] = useState("")
  const sellerDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (trendRef.current && !trendRef.current.contains(e.target as Node)) {
        setTrendOpen(false)
      }
      if (sellerDropdownRef.current && !sellerDropdownRef.current.contains(e.target as Node)) {
        setSellerDropdownOpen(false)
        setSellerSearch("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const [sellerData,  setSellerData]  = useState<Record<string, unknown>[]>([])
  const [brandData,   setBrandData]   = useState<Record<string, unknown>[]>([])
  const [tituloData,  setTituloData]  = useState<Record<string, unknown>[]>([])
  const [trendData,   setTrendData]   = useState<Record<string, unknown>[]>([])
  const [channelData, setChannelData] = useState<Record<string, unknown>[]>([])
  const [loading,     setLoading]     = useState(false)
  const fetchIdRef = useRef(0)
  const trendFetchIdRef = useRef(0)
  const selectedSellersRef = useRef<string[]>([])
  selectedSellersRef.current = selectedSellers

  // Default selectedSeller and selectedSellers to top 5 by SOS when sellerData loads
  useEffect(() => {
    if (sellerData.length === 0 || trendInitRef.current) return
    trendInitRef.current = true
    const top5 = sellerData.slice(0, 5).map(e => String(e.seller))
    setSelectedSellers(top5)
    // Set selectedSeller to Abbott if present in data, else top 1
    const abbottEntry = sellerData.find(e => String(e.seller).toUpperCase() === "ABBOTT")
    setSelectedSeller(abbottEntry ? String(abbottEntry.seller) : top5[0])
  }, [sellerData])

  // Reset visible count when drill level or data changes
  useEffect(() => { setVisibleCount(10) }, [drill, sellerData, brandData, tituloData])

  // ── Cargar rango de fechas disponible ─────────────────────
  useEffect(() => {
    fetch("/api/search?action=dates")
      .then(r => r.json())
      .then((d: { min: string; max: string }) => {
        setMinDate(d.min); setMaxDate(d.max)
        setStartDate(d.min); setEndDate(d.max)
      })
      .catch(() => {})
  }, [])

  // ── Cascading: retails filtrados por categoría + país + fechas ───
  useEffect(() => {
    if (!startDate || !endDate) return
    const p = new URLSearchParams({ action: "channels" })
    if (category)  p.set("search",  category)
    if (startDate) p.set("startDate", startDate)
    if (endDate)   p.set("endDate",   endDate)
    if (country)   p.set("country",  country)
    fetch(`/api/search?${p}`)
      .then(r => r.json())
      .then((data: string[]) => {
        if (!Array.isArray(data)) return
        setAvailableChannels(data)
        if (channel && !data.includes(channel)) setChannel("")
      })
  }, [category, startDate, endDate, country])

  // ── Cascading: búsquedas filtradas por retail + país + fechas ────
  useEffect(() => {
    if (!startDate || !endDate) return
    const p = new URLSearchParams({ action: "searches" })
    if (channel)   p.set("channel",   channel)
    if (startDate) p.set("startDate", startDate)
    if (endDate)   p.set("endDate",   endDate)
    if (country)   p.set("country",   country)
    fetch(`/api/search?${p}`)
      .then(r => r.json())
      .then((data: string[]) => {
        if (!Array.isArray(data)) return
        setAvailableCategories(data)
        if (category && !data.includes(category)) setCategory("")
      })
  }, [channel, startDate, endDate, country])

  // ── Cascading: segmentos filtrados por retail + mercado ────────────
  useEffect(() => {
    const p = new URLSearchParams({ action: "segmentos" })
    if (channel)  p.set("channel",  channel)
    if (mercado)  p.set("mercado", mercado)
    if (country)  p.set("country", country)
    fetch(`/api/search?${p}`)
      .then(r => r.json())
      .then((data: string[]) => {
        if (!Array.isArray(data)) return
        setAvailableSegmentos(data)
        if (segmento && !data.includes(segmento)) setSegmento("")
      })
  }, [channel, mercado, country])

  // ── Cascading: mercados filtrados por retail + segmento ─────────────
  useEffect(() => {
    const p = new URLSearchParams({ action: "mercados" })
    if (channel)  p.set("channel",  channel)
    if (segmento) p.set("segmento", segmento)
    if (country)  p.set("country",  country)
    fetch(`/api/search?${p}`)
      .then(r => r.json())
      .then((data: string[]) => {
        if (!Array.isArray(data)) return
        setAvailableMercados(data)
        if (mercado && !data.includes(mercado)) setMercado("")
      })
  }, [channel, segmento, country])

  const api = useCallback(
    (action: string) =>
      fetch(
        `/api/search?action=${action}` +
        `&channel=${encodeURIComponent(channel)}` +
        `&search=${encodeURIComponent(category)}` +
        `&segmento=${encodeURIComponent(segmento)}` +
        `&mercado=${encodeURIComponent(mercado)}` +
        `&seller=${encodeURIComponent(selectedSeller)}` +
        `&sellers=${selectedSellersRef.current.join(",")}` +
        `&page=${page}` +
        `&country=${encodeURIComponent(country)}` +
        (startDate ? `&startDate=${startDate}` : "") +
        (endDate   ? `&endDate=${endDate}`     : "")
      )
        .then(r => r.json())
        .then(d => (Array.isArray(d) ? d : [])),
    [channel, category, segmento, mercado, selectedSeller, page, country, startDate, endDate]
  )

  useEffect(() => {
    if (!startDate || !endDate) return          // wait until dates are loaded
    const id = ++fetchIdRef.current
    setLoading(true)
    Promise.all([
      api("sellers"),
      api("brands"),
      api("titulos"),
      api("by_channel"),
    ]).then(([sellers, brands, titulos, channels]) => {
      if (id !== fetchIdRef.current) return
      setSellerData(sellers)
      setBrandData(brands)
      setTituloData(titulos)
      setChannelData(channels)
    }).finally(() => {
      if (id === fetchIdRef.current) setLoading(false)
    })
  }, [api])

  // ── Trend fetch — separate, driven by selectedSellers ──────────────
  useEffect(() => {
    if (!startDate || !endDate || selectedSellers.length === 0) return
    const id = ++trendFetchIdRef.current
    setTrendData([])
    const sellersParam = selectedSellers.map(s => encodeURIComponent(s)).join(",")
    fetch(
      `/api/search?action=trend` +
      `&sellers=${sellersParam}` +
      `&country=${encodeURIComponent(country)}` +
      `&startDate=${startDate}` +
      `&endDate=${endDate}` +
      (channel   ? `&channel=${encodeURIComponent(channel)}`   : "") +
      (category  ? `&search=${encodeURIComponent(category)}`   : "") +
      (segmento  ? `&segmento=${encodeURIComponent(segmento)}` : "") +
      (mercado   ? `&mercado=${encodeURIComponent(mercado)}`   : "") +
      `&page=${page}`
    )
      .then(r => r.json())
      .then(d => { if (id === trendFetchIdRef.current && Array.isArray(d)) setTrendData(d) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSellers.join(","), startDate, endDate, country, channel, category, segmento, mercado, page])

  function downloadCSV() {
    const datePart = startDate && endDate ? `${startDate}_${endDate}` : "todas-las-fechas"
    const chanPart = (channel || "todos-retails").replace(/\s+/g, "-")
    const catPart  = (category || "todas-busquedas").replace(/\s+/g, "-")

    let headers: string[]
    let rows: string[][]

    if (drill === "seller") {
      headers = ["#", "Fabricante", "Pos. Pág 1 (%)", "Δ Pos. Pág 1 (pp)", "Pos. Total (%)", "Δ Pos. Total (pp)", "Prods Pág 1"]
      rows = sellerData.map((e, i) => [
        String(i + 1),
        String(e.seller),
        String(e.sos_p1),
        String(e.sos_p1_change),
        String(e.sos_total),
        String(e.sos_total_change),
        String(e.products_p1),
      ])
    } else if (drill === "brand") {
      headers = ["Marca", "Fabricante", "Pos. Pág 1 (%)", "Δ Pos. Pág 1 (pp)", "Pos. Total (%)", "Prods Pág 1"]
      rows = brandData.map(b => [
        String(b.brand),
        String(b.seller),
        String(b.sos_p1),
        String(b.sos_p1_change),
        String(b.sos_total),
        String(b.products_p1),
      ])
    } else {
      headers = ["Título", "Fabricante", "Pos. Pág 1 (%)", "Δ Pos. Pág 1 (pp)", "Pos. Total (%)", "Pos. típica"]
      rows = tituloData.map(t => [
        String(t.titulo),
        String(t.seller),
        String(t.sos_p1),
        String(t.sos_p1_change),
        String(t.sos_total),
        String(t.ranking_pos),
      ])
    }

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = [headers, ...rows].map(row => row.map(esc).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `search_${drill}_${datePart}_${chanPart}_${catPart}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const ownEntry  = sellerData.find((e) => e.seller === selectedSeller) as Record<string, unknown> | undefined
  const ownColor  = COLORS[selectedSeller] || "#a427ff"

  // Top 15 sellers by current page SOS; the rest collapsed into "Otros"
  const TOP_N = 8
  const sortedSellers = [...sellerData].sort(
    (a, b) => Number(page === "p1" ? b.sos_p1 : b.sos_total) - Number(page === "p1" ? a.sos_p1 : a.sos_total)
  )
  const top15    = sortedSellers.slice(0, TOP_N)
  const rest     = sortedSellers.slice(TOP_N)
  const otrosVal = rest.reduce((sum, e) => sum + Number(page === "p1" ? e.sos_p1 : e.sos_total), 0)
  const stackedData = [
    ...top15.map(e => ({
      label: String(e.seller),
      value: Number(page === "p1" ? e.sos_p1 : e.sos_total),
      color: String(e.color),
    })),
    ...(rest.length > 0 ? [{ label: "Otros", value: Math.round(otrosVal * 10) / 10, color: "#d1d5db" }] : []),
  ]
  const maxSOS    = Math.max(...sellerData.map(e => Number(e.sos_p1)), 1)
  const maxChannel = Math.max(...channelData.map(e => Number(page === "p1" ? e.sos_p1 : e.sos_total)), 1)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Share of Search"
        subtitle="Presencia por fabricante, marca y título en resultados de búsqueda"
      />

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl">

        {/* Fechas */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Desde</span>
          <DateInput value={startDate} min={minDate} max={endDate || maxDate} onChange={setStartDate} />
          <span className="text-xs text-gray-400">Hasta</span>
          <DateInput value={endDate} min={startDate || minDate} max={maxDate} onChange={setEndDate} />
        </div>

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Retail */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Retail</span>
          <select
            value={channel}
            onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white w-[130px]"
          >
            <option value="">Todos los retails</option>
            {availableChannels.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Search</span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white w-[150px]"
          >
            <option value="">Todas las búsquedas</option>
            {availableCategories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Mercado */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Mercado</span>
          <select
            value={mercado}
            onChange={e => { setMercado(e.target.value); if (!e.target.value) setSegmento("") }}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white w-[110px]"
          >
            <option value="">Todos</option>
            {availableMercados.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        {/* Segmento */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Segmento</span>
          <select
            value={segmento}
            onChange={e => setSegmento(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white w-[130px]"
          >
            <option value="">Todos</option>
            {availableSegmentos.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Fabricante con buscador */}
        <div className="w-px h-5 bg-gray-200 hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fabricante</span>
          <div className="relative" ref={sellerDropdownRef}>
            <button
              onClick={() => { setSellerDropdownOpen(prev => !prev); setSellerSearch("") }}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg bg-white hover:border-gray-400 transition-colors min-w-[140px] justify-between"
            >
              <span className="truncate">{selectedSeller || "Seleccionar"}</span>
              <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {sellerDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-64">
                <div className="p-2 border-b border-gray-100">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Buscar fabricante..."
                    value={sellerSearch}
                    onChange={e => setSellerSearch(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-purple-400"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {SELLERS.filter(s => s.toLowerCase().includes(sellerSearch.toLowerCase())).map(s => (
                    <button
                      key={s}
                      onClick={() => { setSelectedSeller(s); setSellerDropdownOpen(false); setSellerSearch("") }}
                      className={clsx(
                        "w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors",
                        selectedSeller === s ? "text-purple-700 font-semibold bg-purple-50" : "text-gray-700"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                  {SELLERS.filter(s => s.toLowerCase().includes(sellerSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">Sin resultados</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
          {(["p1", "total"] as PageCtx[]).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={clsx(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                page === p ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {p === "p1" ? "Página 1" : "Total"}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs + charts ─────────────────────────────────── */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-2xl">
            <div className="w-9 h-9 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      <div className={`space-y-4 ${loading ? "pointer-events-none" : ""}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: `Pos. ${page === "p1" ? "Pág 1" : "Total"} · ${selectedSeller}`,
            value: `${(page === "p1" ? ownEntry?.sos_p1 : ownEntry?.sos_total) ?? 0}%`,
            change: Number(page === "p1" ? ownEntry?.sos_p1_change : ownEntry?.sos_total_change),
          },
          {
            label: "Posición en retail",
            value: `#${(sellerData.findIndex(e => e.seller === selectedSeller) + 1) || "—"}`,
          },
          {
            label: "Apariciones en pág. 1",
            value: String(ownEntry?.products_p1 ?? 0),
          },
          {
            label: "Fabricantes analizados",
            value: String(sellerData.length),
          },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col items-center justify-center min-h-[110px] text-center">
            <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">{k.label}</div>
            <div className="text-2xl font-bold text-gray-900">{k.value}</div>
            {k.change != null && !isNaN(k.change) && (
              <div className="mt-1">
                <Change val={k.change} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Stacked + Por retail ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stacked overview */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">
            Posición {page === "p1" ? "Página 1" : "Total"}{category ? ` · ${category}` : ""}{channel ? ` · ${channel}` : ""}
          </div>
          <div className="text-xs text-gray-400 mb-3">Share acumulado de todos los fabricantes</div>
          <StackedBar data={stackedData} />
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
            {stackedData.map(e => (
              <div key={e.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: e.color }} />
                <span className="text-[11px] text-gray-600">{e.label}</span>
                <span className="text-[11px] font-semibold text-gray-900 font-mono">
                  {e.value}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Por retail */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">
            Pos. por retail · {selectedSeller}
          </div>
          <div className="text-xs text-gray-400 mb-3">Presencia en cada retail</div>
          <div className="space-y-3">
            {[...channelData].sort((a, b) => Number(page === "p1" ? b.sos_p1 : b.sos_total) - Number(page === "p1" ? a.sos_p1 : a.sos_total)).map((d, i) => (
              <div key={String(d.channel)} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-32 shrink-0 truncate">{String(d.channel)}</span>
                <div className="flex-1">
                  <SOSBar pct={Number(page === "p1" ? d.sos_p1 : d.sos_total)} color={getRetailColor(String(d.channel), i)} max={maxChannel * 1.2} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tendencia 12 semanas ──────────────────────────── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] uppercase tracking-widest text-gray-500">
            Evolución Posición
          </div>
          {/* Multi-select dropdown — sellers ordered by SOS desc */}
          <div className="relative" ref={trendRef}>
            <button
              onClick={() => setTrendOpen(prev => !prev)}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg bg-white hover:border-gray-400 transition-colors min-w-[130px] justify-between"
            >
              <span>
                {selectedSellers.length === 0
                  ? "Ningún fabricante"
                  : selectedSellers.length === 1
                  ? selectedSellers[0]
                  : `${selectedSellers.length} fabricantes`}
              </span>
              <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {trendOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-60 max-h-72 overflow-y-auto">
                {sellerData.map(e => {
                  const s = String(e.seller)
                  const checked = selectedSellers.includes(s)
                  const val = Number(page === "p1" ? e.sos_p1 : e.sos_total)
                  return (
                    <label key={s} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedSellers(prev =>
                            prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                          )
                        }
                        className="w-3.5 h-3.5 rounded accent-purple-600 shrink-0"
                      />
                      <span className="flex-1 text-xs text-gray-700 truncate">{s}</span>
                      <span className="text-[11px] font-mono font-semibold text-gray-400">{val}%</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <TrendChart data={trendData} sellers={selectedSellers} colors={COLORS} />
        <div className="flex flex-wrap gap-4 mt-3">
          {selectedSellers.map(s => {
            const last    = trendData[trendData.length - 1]
            const prev    = trendData[trendData.length - 2]
            const val     = last ? Number(last[s] || 0) : 0
            const prevVal = prev ? Number(prev[s] || 0) : 0
            return (
              <div key={s} className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS[s] || "#a427ff" }} />
                <span className="text-xs text-gray-600">{s}</span>
                <span className="text-xs font-semibold text-gray-900 font-mono">{val}%</span>
                <Change val={Math.round((val - prevVal) * 10) / 10} />
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Drill-down table ──────────────────────────────── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="text-[11px] uppercase tracking-widest text-gray-500">
            {category || "Todas las búsquedas"} · {channel || "Todos los retails"}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
              title="Descargar CSV con los filtros actuales"
            >
              <Download size={12} />
              <span>CSV</span>
            </button>
            <button onClick={exportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
              title="Exportar PDF">
              <FileText size={12} />
              <span>PDF</span>
            </button>
            <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
              {(["seller", "brand", "titulo"] as DrillLevel[]).map(l => (
                <button
                  key={l}
                  onClick={() => setDrill(l)}
                  className={clsx(
                    "px-3 py-1 rounded-md text-xs font-medium transition-all",
                    drill === l ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {l === "seller" ? "Fabricante" : l === "brand" ? "Marca" : "Título"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fabricante table */}
        {drill === "seller" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {["#", "Fabricante", "Pos. Pág 1", "Δ", "Pos. Total", "Δ", "Prods Pág 1", "Share"].map((h, i) => (
                    <th
                      key={h}
                      className="text-[10px] uppercase tracking-wider text-gray-400 text-left pb-2 px-2 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sellerData.slice(0, visibleCount).map((e, i) => {
                  const isOwn = e.seller === selectedSeller
                  return (
                    <tr
                      key={String(e.seller)}
                      onClick={() => setSelectedSeller(String(e.seller))}
                      className={clsx(
                        "border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors",
                        isOwn && "bg-purple-50/30"
                      )}
                    >
                      <td className="px-2 py-2.5 text-xs text-gray-400">#{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: String(e.color) }} />
                          <span className={clsx("text-sm font-medium", isOwn ? "text-gray-900" : "text-gray-600")}>
                            {String(e.seller)}
                          </span>
                          {isOwn && (
                            <span className="text-[9px] px-1.5 rounded bg-purple-100 text-purple-600 font-bold">
                              tú
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-sm font-bold text-gray-900 font-mono">{Number(e.sos_p1)}%</td>
                      <td className="px-2 py-2.5">
                        <Change val={Number(e.sos_p1_change)} />
                      </td>
                      <td className="px-2 py-2.5 text-xs text-gray-500 font-mono">{Number(e.sos_total)}%</td>
                      <td className="px-2 py-2.5">
                        <Change val={Number(e.sos_total_change)} />
                      </td>
                      <td className="px-2 py-2.5 text-xs text-gray-500">{Number(e.products_p1)}</td>
                      <td className="px-2 py-2.5 w-32">
                        <SOSBar pct={Number(e.sos_p1)} color={String(e.color)} max={maxSOS * 1.1} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visibleCount < sellerData.length && (
              <button
                onClick={() => setVisibleCount(prev => Math.min(prev + 50, sellerData.length))}
                className="mt-3 w-full text-xs text-purple-600 hover:text-purple-800 font-medium py-2 border border-dashed border-purple-200 hover:border-purple-400 rounded-lg transition-colors"
              >
                Ver más ({Math.min(50, sellerData.length - visibleCount)} de {sellerData.length - visibleCount} restantes)
              </button>
            )}
          </div>
        )}

        {/* Brand table */}
        {drill === "brand" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Marca", "Fabricante", "Pos. Pág 1", "Δ", "Pos. Total", "Prods Pág 1"].map(h => (
                    <th
                      key={h}
                      className="text-[10px] uppercase tracking-wider text-gray-400 text-left pb-2 px-2 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brandData.slice(0, visibleCount).map(b => (
                  <tr key={String(b.brand)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-2 py-2.5 text-sm font-medium text-gray-800">{String(b.brand)}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-500">{String(b.seller)}</td>
                    <td className="px-2 py-2.5 text-sm font-bold text-gray-900 font-mono">{Number(b.sos_p1)}%</td>
                    <td className="px-2 py-2.5">
                      <Change val={Number(b.sos_p1_change)} />
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-500 font-mono">{Number(b.sos_total)}%</td>
                    <td className="px-2 py-2.5 text-xs text-gray-500">{Number(b.products_p1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleCount < brandData.length && (
              <button
                onClick={() => setVisibleCount(prev => Math.min(prev + 50, brandData.length))}
                className="mt-3 w-full text-xs text-purple-600 hover:text-purple-800 font-medium py-2 border border-dashed border-purple-200 hover:border-purple-400 rounded-lg transition-colors"
              >
                Ver más ({Math.min(50, brandData.length - visibleCount)} de {brandData.length - visibleCount} restantes)
              </button>
            )}
          </div>
        )}

        {/* Título table */}
        {drill === "titulo" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Título", "Fabricante", "EAN", "SKU", "MLA", "Pos. Pág 1", "Δ", "Pos. Total", "Pos. típica"].map(h => (
                    <th
                      key={h}
                      className="text-[10px] uppercase tracking-wider text-gray-400 text-left pb-2 px-2 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tituloData.slice(0, visibleCount).map(t => (
                  <tr key={String(t.titulo_id)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-2 py-2.5 text-sm text-gray-800 max-w-[220px] truncate">{String(t.titulo)}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-500">{String(t.seller)}</td>
                    <td className="px-2 py-2.5 text-[10px] font-mono text-gray-600">{t.ean ? String(t.ean) : "—"}</td>
                    <td className="px-2 py-2.5 text-[10px] font-mono text-gray-600">{t.sku ? String(t.sku) : "—"}</td>
                    <td className="px-2 py-2.5 text-[10px] font-mono text-gray-600">{t.meli_id ? String(t.meli_id) : "—"}</td>
                    <td className="px-2 py-2.5 text-sm font-bold text-gray-900 font-mono">{Number(t.sos_p1)}%</td>
                    <td className="px-2 py-2.5">
                      <Change val={Number(t.sos_p1_change)} />
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-500 font-mono">{Number(t.sos_total)}%</td>
                    <td
                      className="px-2 py-2.5 text-xs font-semibold"
                      style={{
                        color:
                          Number(t.ranking_pos) <= 5
                            ? "#16a34a"
                            : Number(t.ranking_pos) <= 15
                            ? "#d97706"
                            : "#9ca3af",
                      }}
                    >
                      #{Number(t.ranking_pos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleCount < tituloData.length && (
              <button
                onClick={() => setVisibleCount(prev => Math.min(prev + 50, tituloData.length))}
                className="mt-3 w-full text-xs text-purple-600 hover:text-purple-800 font-medium py-2 border border-dashed border-purple-200 hover:border-purple-400 rounded-lg transition-colors"
              >
                Ver más ({Math.min(50, tituloData.length - visibleCount)} de {tituloData.length - visibleCount} restantes)
              </button>
            )}
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  )
}
