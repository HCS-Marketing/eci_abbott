"use client"
import { useMarket } from "@/lib/use-market"
import PageHeader from "@/components/ui/PageHeader"
import { useState, useEffect, useCallback } from "react"
import clsx from "clsx"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

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
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  return (
    <div className="flex rounded-lg overflow-hidden" style={{ height: 28 }}>
      {data.map(d => (
        <div
          key={d.label}
          style={{
            width: `${(d.value / total) * 100}%`,
            backgroundColor: d.color,
            minWidth: d.value > 1 ? 2 : 0,
          }}
          title={`${d.label}: ${d.value}%`}
        />
      ))}
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
  if (!data.length || !sellers.length) return null
  const W = 560, H = 160, padL = 36, padR = 12, padT = 12, padB = 20
  const allVals = data.flatMap(pt => sellers.map(s => Number(pt[s] || 0)))
  const minV = Math.max(0, Math.min(...allVals) - 2)
  const maxV = Math.max(...allVals, 1) + 2
  const x = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * (H - padT - padB)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
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
        .filter((_, i) => i % 3 === 0)
        .map((pt, i) => (
          <text key={i} x={x(i * 3)} y={H - 4} textAnchor="middle" fill="#9ca3af" fontSize="9">
            {String(pt.week)}
          </text>
        ))}
    </svg>
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

  // Filtros
  const [channel,    setChannel]    = useState("")
  const [category,   setCategory]   = useState("")
  const [startDate,  setStartDate]  = useState("")
  const [endDate,    setEndDate]    = useState("")
  const [minDate,    setMinDate]    = useState("")
  const [maxDate,    setMaxDate]    = useState("")

  // Opciones dinámicas de los selects
  const [availableChannels,    setAvailableChannels]    = useState<string[]>([])
  const [availableCategories,  setAvailableCategories]  = useState<string[]>([])
  const [selectedSeller,  setSelectedSeller]  = useState(SELLERS[0] || "")
  const [selectedSellers, setSelectedSellers] = useState(SELLERS.slice(0, 4))
  const [page,  setPage]  = useState<PageCtx>("p1")
  const [drill, setDrill] = useState<DrillLevel>("seller")

  const [sellerData,  setSellerData]  = useState<Record<string, unknown>[]>([])
  const [brandData,   setBrandData]   = useState<Record<string, unknown>[]>([])
  const [tituloData,  setTituloData]  = useState<Record<string, unknown>[]>([])
  const [trendData,   setTrendData]   = useState<Record<string, unknown>[]>([])
  const [channelData, setChannelData] = useState<Record<string, unknown>[]>([])

  // sync when market changes — prefer "Newsan" as default
  useEffect(() => {
    if (SELLERS.length === 0) return
    const preferred = SELLERS.includes("Newsan") ? "Newsan" : SELLERS[0]
    setSelectedSeller(preferred)
    const top4 = SELLERS.includes("Newsan")
      ? [preferred, ...SELLERS.filter(s => s !== preferred).slice(0, 3)]
      : SELLERS.slice(0, 4)
    setSelectedSellers(top4)
  }, [SELLERS[0]])

  // ── Cargar rango de fechas disponible ─────────────────────
  useEffect(() => {
    fetch("/api/sos?action=dates")
      .then(r => r.json())
      .then((d: { min: string; max: string }) => {
        setMinDate(d.min); setMaxDate(d.max)
        setStartDate(d.min); setEndDate(d.max)
      })
      .catch(() => {})
  }, [])

  // ── Cascading: canales filtrados por categoría + fechas ───
  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    if (category)  p.set("category",  category)
    if (startDate) p.set("startDate", startDate)
    if (endDate)   p.set("endDate",   endDate)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then((data: string[]) => {
        if (!Array.isArray(data)) return
        setAvailableChannels(data)
        if (channel && !data.includes(channel)) setChannel("")
      })
  }, [category, startDate, endDate])

  // ── Cascading: categorías filtradas por canal + fechas ────
  useEffect(() => {
    const p = new URLSearchParams({ action: "categories" })
    if (channel)   p.set("channel",   channel)
    if (startDate) p.set("startDate", startDate)
    if (endDate)   p.set("endDate",   endDate)
    fetch(`/api/sos?${p}`)
      .then(r => r.json())
      .then((data: string[]) => {
        if (!Array.isArray(data)) return
        setAvailableCategories(data)
        if (category && !data.includes(category)) setCategory("")
      })
  }, [channel, startDate, endDate])

  const api = useCallback(
    (action: string) =>
      fetch(
        `/api/sos?action=${action}` +
        `&channel=${encodeURIComponent(channel)}` +
        `&category=${encodeURIComponent(category)}` +
        `&seller=${encodeURIComponent(selectedSeller)}` +
        `&sellers=${selectedSellers.join(",")}` +
        `&page=${page}` +
        (startDate ? `&startDate=${startDate}` : "") +
        (endDate   ? `&endDate=${endDate}`     : "")
      )
        .then(r => r.json())
        .then(d => (Array.isArray(d) ? d : [])),
    [channel, category, selectedSeller, selectedSellers, page, startDate, endDate]
  )

  useEffect(() => {
    Promise.all([
      api("sellers").then(setSellerData),
      api("brands").then(setBrandData),
      api("titulos").then(setTituloData),
      api("trend").then(setTrendData),
      api("by_channel").then(setChannelData),
    ])
  }, [api])

  const ownEntry  = sellerData.find((e) => e.seller === selectedSeller) as Record<string, unknown> | undefined
  const ownColor  = COLORS[selectedSeller] || "#a427ff"
  const stackedData = sellerData.map(e => ({
    label: String(e.seller),
    value: Number(page === "p1" ? e.sos_p1 : e.sos_total),
    color: String(e.color),
  }))
  const maxSOS    = Math.max(...sellerData.map(e => Number(e.sos_p1)), 1)
  const maxChannel = Math.max(...channelData.map(e => Number(e.sos_p1)), 1)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Share of Shelf"
        subtitle="Presencia por seller, marca y título en página 1 y total"
      />

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl">

        {/* Fechas */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Desde</span>
          <input
            type="date"
            value={startDate}
            min={minDate}
            max={endDate || maxDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg outline-none bg-white"
          />
          <span className="text-xs text-gray-400">Hasta</span>
          <input
            type="date"
            value={endDate}
            min={startDate || minDate}
            max={maxDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg outline-none bg-white"
          />
        </div>

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Canal */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Canal</span>
          <select
            value={channel}
            onChange={e => setChannel(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white"
          >
            <option value="">Todos los canales</option>
            {availableChannels.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Categoría */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Categoría</span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white"
          >
            <option value="">Todas las categorías</option>
            {availableCategories.map(c => <option key={c}>{c}</option>)}
          </select>
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

      {/* ── KPIs ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: `SOS ${page === "p1" ? "Pág 1" : "Total"} · ${selectedSeller}`,
            value: `${(page === "p1" ? ownEntry?.sos_p1 : ownEntry?.sos_total) ?? 0}%`,
            change: Number(page === "p1" ? ownEntry?.sos_p1_change : ownEntry?.sos_total_change),
          },
          {
            label: "Posición en canal",
            value: `#${(sellerData.findIndex(e => e.seller === selectedSeller) + 1) || "—"}`,
          },
          {
            label: "Productos en pág 1",
            value: String(ownEntry?.products_p1 ?? 0),
          },
          {
            label: "Sellers analizados",
            value: String(sellerData.length),
          },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold text-gray-900">{k.value}</div>
            {k.change != null && !isNaN(k.change) && (
              <div className="mt-1">
                <Change val={k.change} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Stacked + Por canal ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stacked overview */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
            SOS {page === "p1" ? "Página 1" : "Total"}{category ? ` · ${category}` : ""}{channel ? ` · ${channel}` : ""}
          </div>
          <div className="text-xs text-gray-400 mb-3">Share acumulado de todos los sellers</div>
          <StackedBar data={stackedData} />
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
            {sellerData.map(e => (
              <div key={String(e.seller)} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: String(e.color) }} />
                <span className="text-[11px] text-gray-600">{String(e.seller)}</span>
                <span className="text-[11px] font-semibold text-gray-900 font-mono">
                  {Number(page === "p1" ? e.sos_p1 : e.sos_total)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Por canal */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
            SOS por canal · {selectedSeller}
          </div>
          <div className="text-xs text-gray-400 mb-3">Presencia en cada canal</div>
          <div className="space-y-3">
            {channelData.map(d => (
              <div key={String(d.channel)}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{String(d.channel)}</span>
                  <div className="flex items-center gap-2">
                    <Change val={Number(d.sos_p1_change)} />
                    <span className="text-gray-900 font-semibold font-mono">{Number(d.sos_p1)}%</span>
                  </div>
                </div>
                <SOSBar pct={Number(d.sos_p1)} color={ownColor} max={maxChannel * 1.2} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tendencia 12 semanas ──────────────────────────── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-400">
            Evolución SOS · últimas 12 semanas
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {SELLERS.map(s => (
              <button
                key={s}
                onClick={() =>
                  setSelectedSellers(prev =>
                    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                  )
                }
                className={clsx(
                  "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border",
                  selectedSellers.includes(s)
                    ? "text-white border-transparent"
                    : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
                )}
                style={selectedSellers.includes(s) ? { backgroundColor: COLORS[s] || "#a427ff" } : {}}
              >
                {s}
              </button>
            ))}
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
          <div className="text-[10px] uppercase tracking-widest text-gray-400">
            {category || "Todas las categorías"} · {channel || "Todos los canales"}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedSeller}
              onChange={e => setSelectedSeller(e.target.value)}
              className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white"
            >
              {SELLERS.map(s => <option key={s}>{s}</option>)}
            </select>
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
                  {l === "seller" ? "Seller" : l === "brand" ? "Marca" : "Título"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Seller table */}
        {drill === "seller" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {["#", "Seller", "SOS Pág 1", "Δ", "SOS Total", "Δ", "Prods Pág 1", "Share"].map(h => (
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
                {sellerData.map((e, i) => {
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
          </div>
        )}

        {/* Brand table */}
        {drill === "brand" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Marca", "Seller", "SOS Pág 1", "Δ", "SOS Total", "Prods Pág 1"].map(h => (
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
                {brandData.map(b => (
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
          </div>
        )}

        {/* Título table */}
        {drill === "titulo" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {["ID", "Título", "Seller", "SOS Pág 1", "Δ", "SOS Total", "Pos. típica"].map(h => (
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
                {tituloData.map(t => (
                  <tr key={String(t.titulo_id)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-2 py-2.5 text-[10px] font-mono text-gray-400">{String(t.titulo_id)}</td>
                    <td className="px-2 py-2.5 text-sm text-gray-800 max-w-[220px] truncate">{String(t.titulo)}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-500">{String(t.seller)}</td>
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
          </div>
        )}
      </div>
    </div>
  )
}
