"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useMarket } from "@/lib/use-market"
import { useGlobalFilters } from "@/lib/filter-context"
import PageHeader from "@/components/ui/PageHeader"
import DateInput from "@/components/ui/DateInput"
import ProductMultiSelect from "@/components/ui/ProductMultiSelect"
import ContentGlossary from "@/components/ui/ContentGlossary"
import fallbackRows from "@/data/mx-provider-rows.json"
import { ExternalLink, Image as ImageIcon, Link as LinkIcon, Search, Download, FileText, Star, Video } from "lucide-react"
import { downloadCSV, exportPDF } from "@/lib/export"

interface CatalogRow {
  titulo: string
  skuid: string
  ean: string
  categoria: string
  canal: string
  valoracion: number
  reviews: number
  img_count: number
  video_count: number
  bullet_points: number
  title_count_characters: number
  count_character_desc: number
  url_producto: string
  score: number
  content_score: number
  rank: number
}

type ContentSortBy = "reviews" | "valoracion" | "score"
type ContentSortDir = "asc" | "desc"
type TableMode = "score" | "content"

const CO_PERFECT_STORE_CHANNEL = "FARMATODO"

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

function calculateContentScore(row: {
  canal: string
  img_count: number
  video_count: number
  bullet_points: number
  title_count_characters: number
  count_character_desc: number
}): number {
  const isAmazon = String(row.canal || "").toUpperCase().includes("AMAZON")

  if (isAmazon) {
    let score = 0
    if (inRange(row.title_count_characters, 150, 195)) score += 25
    if (row.img_count >= 5) score += 20
    if (row.video_count >= 1) score += 15
    if (inRange(row.count_character_desc, 1200, 1500)) score += 25
    if (row.bullet_points >= 5) score += 15
    return score
  }

  let score = 0
  if (inRange(row.title_count_characters, 60, 120)) score += 25
  if (inRange(row.count_character_desc, 300, 500)) score += 25
  if (inRange(row.img_count, 5, 10)) score += 20
  if (row.bullet_points >= 5) score += 20
  if (row.video_count >= 1) score += 10
  return score
}

function productUrlHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return "URL no disponible"
  }
}

function normalizeCatalogRow(
  r: {
    titulo?: string
    skuid?: string
    ean?: string
    categoria?: string
    retail?: string
    plataforma?: string
    canal?: string
    valoracion?: number
    reviews?: number
    img_count?: number
    video_count?: number
    bullet_points?: number
    title_count_characters?: number
    count_character_desc?: number
    url_producto?: string
    score?: number
    rank?: number
  },
  idx: number
): CatalogRow {
  const canal = String(r.canal || r.plataforma || r.retail || "").trim()
  const base = {
    titulo: String(r.titulo || ""),
    skuid: String(r.skuid || `${canal}-${idx + 1}`),
    ean: String(r.ean || "").trim(),
    categoria: String(r.categoria || "").trim(),
    canal,
    valoracion: Number(r.valoracion || 0),
    reviews: Number(r.reviews || 0),
    img_count: Number(r.img_count || 0),
    video_count: Number(r.video_count || 0),
    bullet_points: Number(r.bullet_points || 0),
    title_count_characters: Number(r.title_count_characters || 0),
    count_character_desc: Number(r.count_character_desc || 0),
    url_producto: String(r.url_producto || "").trim(),
    score: Number(r.score || 0),
    rank: Number(r.rank || (idx + 1)),
  }

  return {
    ...base,
    content_score: calculateContentScore(base),
  }
}

export default function CatalogContentPage() {
  useMarket()
  const { country } = useGlobalFilters()

  const normalizeChannel = (value: string) => {
    const v = String(value || "").trim().toUpperCase()
    if (!v) return ""
    if (v === "ML" || v.includes("MERCADO")) return "MERCADO LIBRE"
    if (v.includes("AMAZON")) return "AMAZON"
    if (v === "SAMS" || v.includes("SAM'S") || v.includes("SAMS CLUB")) return "SAMS CLUB"
    if (v === "HEB" || v.includes("H-E-B")) return "HEB"
    return v
  }

  const [channel, setChannel] = useState("")
  const [category, setCategory] = useState("")
  const [date, setDate] = useState("")
  const [minDate, setMinDate] = useState("")
  const [maxDate, setMaxDate] = useState("")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<ContentSortBy>("score")
  const [sortDir, setSortDir] = useState<ContentSortDir>("desc")
  const [tableMode, setTableMode] = useState<TableMode>("score")

  const [availableProducts, setAvailableProducts] = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [availableChannels, setAvailableChannels] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [data, setData] = useState<CatalogRow[]>([])
  const [previewProduct, setPreviewProduct] = useState<CatalogRow | null>(null)
  const [loading, setLoading] = useState(false)
  const isColombia = country === "CO"
  const useLocalFallback = country === "MX"
  const showCategoryFilter = availableCategories.length > 0
  const providerBasePath = isColombia ? "base_prov_co" : "base_prov"
  const forcedChannel = isColombia ? CO_PERFECT_STORE_CHANNEL : ""
  const selectedChannel = forcedChannel || channel

  const fallbackDateBounds = useMemo(() => {
    const dates = Array.from(new Set((fallbackRows as Array<{ fecha?: string }>).map(r => r.fecha).filter(Boolean) as string[])).sort()
    return { min: dates[0] || "", max: dates[dates.length - 1] || "" }
  }, [])

  useEffect(() => {
    setChannel(country === "CO" ? CO_PERFECT_STORE_CHANNEL : "")
    setCategory("")
    setDate("")
    setMinDate("")
    setMaxDate("")
    setAvailableChannels([])
    setAvailableCategories([])
    setAvailableProducts([])
    setSelectedProducts([])
    setPreviewProduct(null)
    setData([])
  }, [country])

  useEffect(() => {
    if (useLocalFallback && !date && fallbackDateBounds.max) {
      setMinDate(fallbackDateBounds.min)
      setMaxDate(fallbackDateBounds.max)
      setDate(fallbackDateBounds.max)
    }
  }, [date, fallbackDateBounds, useLocalFallback])

  useEffect(() => {
    const p = new URLSearchParams({ action: "dates" })
    p.set("source", "provider")
    if (selectedChannel) p.set("channel", selectedChannel)
    if (country) p.set("country", country)
    fetch(`/api/provider?${p}`).then(r => r.json()).then((d: { min: string; max: string }) => {
      if (!d?.max) return
      setMinDate(d.min)
      setMaxDate(d.max)
      setDate(d.max)
    })
  }, [country, selectedChannel])

  useEffect(() => {
    const p = new URLSearchParams({ action: "channels" })
    p.set("source", "provider")
    if (country) p.set("country", country)
    if (date) p.set("endDate", date)

    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then((d: string[]) => {
        const channels = Array.isArray(d) ? d : []
        const scopedChannels = isColombia ? channels.filter(c => c === CO_PERFECT_STORE_CHANNEL) : channels
        const nextChannels = scopedChannels.length > 0 || !isColombia ? scopedChannels : [CO_PERFECT_STORE_CHANNEL]
        setAvailableChannels(nextChannels)
        if (!isColombia && channel && !nextChannels.includes(channel)) setChannel("")
      })
      .catch(() => setAvailableChannels([]))
  }, [channel, country, date, isColombia])

  useEffect(() => {
    const effectiveDate = date || (useLocalFallback ? fallbackDateBounds.max : "")
    const local = useLocalFallback ? Array.from(new Set((fallbackRows as Array<{ titulo: string; fecha: string; retail: string; categoria?: string }>)
      .filter(r => (!effectiveDate || r.fecha === effectiveDate) && (!selectedChannel || normalizeChannel(r.retail) === selectedChannel) && (!category || String(r.categoria || "") === category))
      .map(r => r.titulo)
      .filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")) : []

    const p = new URLSearchParams({ action: "products" })
    if (selectedChannel) p.set("channel", selectedChannel)
    if (category) p.set("category", category)
    if (effectiveDate) p.set("date", effectiveDate)
    if (country) p.set("country", country)

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
  }, [date, selectedChannel, category, country, fallbackDateBounds.max, useLocalFallback])

  useEffect(() => {
    const effectiveDate = date || (useLocalFallback ? fallbackDateBounds.max : "")
    const local = useLocalFallback ? Array.from(new Set((fallbackRows as Array<{ fecha: string; retail: string; categoria?: string }>)
      .filter(r => (!effectiveDate || r.fecha === effectiveDate) && (!selectedChannel || normalizeChannel(r.retail) === selectedChannel))
      .map(r => String(r.categoria || "").trim())
      .filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")) : []

    const p = new URLSearchParams({ action: "categories" })
    if (selectedChannel) p.set("channel", selectedChannel)
    if (effectiveDate) p.set("date", effectiveDate)
    if (country) p.set("country", country)

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
  }, [date, selectedChannel, category, country, fallbackDateBounds.max, useLocalFallback])

  const fetchData = useCallback(() => {
    setLoading(true)
    const effectiveDate = date || (useLocalFallback ? fallbackDateBounds.max : "")
    const p = new URLSearchParams({ action: "content", date: effectiveDate, limit: "5000" })
    p.set("source", "provider")
    if (selectedChannel) p.set("channel", selectedChannel)
    if (category) p.set("category", category)
    if (country) p.set("country", country)
    if (selectedProducts.length) p.set("products", selectedProducts.map(v => encodeURIComponent(v)).join(","))

    fetch(`/api/provider?${p}`)
      .then(r => r.json())
      .then(async d => {
        if (Array.isArray(d) && d.length > 0) {
          setData(d.map((r, i) => normalizeCatalogRow(r, i)))
          return
        }

        const pRaw = new URLSearchParams({ action: "raw", date: effectiveDate, limit: "5000" })
        if (selectedChannel) pRaw.set("channel", selectedChannel)
        if (category) pRaw.set("category", category)
        if (selectedProducts.length) pRaw.set("products", selectedProducts.map(v => encodeURIComponent(v)).join(","))
        if (country) pRaw.set("country", country)
        const raw = await fetch(`/api/provider?${pRaw}`).then(r => r.json())

        const sourceRows = Array.isArray(raw) && raw.length > 0
          ? raw
          : useLocalFallback ? (fallbackRows as Array<{ fecha: string; titulo: string; retail: string; valoracion?: number; reviews?: number; img_count?: number; video_count?: number; bullet_points?: number; title_count_characters?: number; count_character_desc?: number; url_producto?: string; EAN?: string; ean?: string; categoria?: string }>)
              .filter(r => !effectiveDate || r.fecha === effectiveDate)
              .filter(r => !selectedChannel || normalizeChannel(r.retail) === selectedChannel)
              .filter(r => !category || String(r.categoria || "") === category)
              .filter(r => selectedProducts.length === 0 || selectedProducts.includes(r.titulo))
          : []

        const mapped = sourceRows.map((r: {
          titulo?: string; retail?: string; canal?: string; plataforma?: string; valoracion?: number; reviews?: number; img_count?: number; video_count?: number; bullet_points?: number; title_count_characters?: number; count_character_desc?: number; url_producto?: string; EAN?: string; ean?: string; categoria?: string
        }, i: number) => normalizeCatalogRow({
          titulo: r.titulo || "",
          skuid: `${String(r.retail || r.canal || r.plataforma || "")}-${i + 1}`,
          ean: String(r.ean || r.EAN || "").trim(),
          categoria: String(r.categoria || "").trim(),
          canal: String(r.retail || r.canal || r.plataforma || ""),
          valoracion: Number(r.valoracion || 0),
          reviews: Number(r.reviews || 0),
          img_count: Number(r.img_count || 0),
          video_count: Number(r.video_count || 0),
          bullet_points: Number(r.bullet_points || 0),
          title_count_characters: Number(r.title_count_characters || 0),
          count_character_desc: Number(r.count_character_desc || 0),
          url_producto: String(r.url_producto || "").trim(),
          rank: i + 1,
        }, i))

        const maxReviews = mapped.reduce((m, r) => Math.max(m, r.reviews), 0)
        const scored = mapped
          .map(r => {
            const reviewsNorm = maxReviews > 0 ? r.reviews / maxReviews : 0
            const ratingNorm = r.valoracion > 0 ? r.valoracion / 5 : 0
            const score = ((reviewsNorm * 0.6) + (ratingNorm * 0.4)) * 100
            return { ...r, score: Math.round(score * 100) / 100 }
          })
          .sort((a, b) => (b.score - a.score) || (b.reviews - a.reviews) || (b.valoracion - a.valoracion) || a.titulo.localeCompare(b.titulo))
          .map((r, i) => ({ ...r, rank: i + 1 }))

        setData(scored)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [date, selectedChannel, category, country, fallbackDateBounds.max, selectedProducts, useLocalFallback])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() =>
    data.filter(e =>
      (!showCategoryFilter || !category || e.categoria === category) &&
      (selectedProducts.length === 0 || selectedProducts.includes(e.titulo)) && (
        !search ||
        e.titulo.toLowerCase().includes(search.toLowerCase()) ||
        e.ean.toLowerCase().includes(search.toLowerCase()) ||
        e.categoria.toLowerCase().includes(search.toLowerCase()) ||
        e.skuid.toLowerCase().includes(search.toLowerCase())
      )
    )
  , [data, search, selectedProducts, category, showCategoryFilter])

  const sorted = useMemo(() => {
    const rows = [...filtered]
    rows.sort((a, b) => {
      let cmp = 0
      if (sortBy === "reviews") cmp = a.reviews - b.reviews
      else if (sortBy === "valoracion") cmp = a.valoracion - b.valoracion
      else cmp = a.score - b.score
      if (cmp === 0) cmp = a.titulo.localeCompare(b.titulo, "es")
      return sortDir === "asc" ? cmp : -cmp
    })
    return rows
  }, [filtered, sortBy, sortDir])

  function toggleSort(column: ContentSortBy) {
    if (sortBy === column) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortBy(column)
    setSortDir("desc")
  }

  const sortMark = (column: ContentSortBy) => (sortBy !== column ? "" : sortDir === "asc" ? " ▲" : " ▼")

  const avgRating = filtered.length ? (filtered.reduce((s, e) => s + e.valoracion, 0) / filtered.length) : 0
  const totalReviews = filtered.reduce((s, e) => s + e.reviews, 0)
  const preview = previewProduct || sorted[0] || null

  return (
    <div className="space-y-4">
      <PageHeader title="Perfect Store" subtitle={`Calidad de catalogo por producto desde archivos ${providerBasePath}`} />

      <div className="items-center gap-3 flex-wrap p-3 bg-gray-50 border border-gray-200 rounded-xl flex">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Fecha</span>
          <DateInput value={date} min={minDate} max={maxDate} onChange={setDate} />
        </div>
        {maxDate && <span className="text-[10px] text-green-600 font-semibold">Ultima actualizacion BD: {maxDate}</span>}

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Canal</span>
          <select value={selectedChannel} onChange={e => setChannel(e.target.value)} disabled={isColombia} className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white disabled:bg-gray-100 disabled:text-gray-500">
            {!isColombia && <option value="">Todos</option>}
            {availableChannels.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {showCategoryFilter && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Categoria</span>
            <select value={category} onChange={e => setCategory(e.target.value)} className="border border-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg outline-none bg-white">
              <option value="">Todas</option>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        <ProductMultiSelect options={availableProducts} selected={selectedProducts} onChange={setSelectedProducts} label="Producto" />

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => downloadCSV(filtered as unknown as Record<string, unknown>[], "catalog-content")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 transition-colors" title="Descargar CSV">
            <Download size={12} /><span>CSV</span>
          </button>
          <button onClick={exportPDF} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 transition-colors" title="Exportar PDF">
            <FileText size={12} /><span>PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Productos", value: String(filtered.length), color: "#7c3aed", sub: "universo filtrado" },
          { label: "Valoracion promedio", value: avgRating.toFixed(2), color: "#d97706", sub: "escala 0-5" },
          { label: "Reviews acumuladas", value: totalReviews.toLocaleString("es-MX"), color: "#16a34a", sub: "personas que puntuaron" },
          { label: "Top score", value: filtered[0] ? `${filtered[0].score.toFixed(2)}` : "0", color: "#2563eb", sub: "mejor producto" },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {preview && (
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded bg-yellow-100 text-yellow-800 border border-yellow-200">{preview.canal}</span>
              <span className="text-sm font-semibold text-gray-800 truncate">Retail Product Audit</span>
            </div>
            <div className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-1">
              Audit Score: {preview.content_score.toFixed(0)}/100
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 p-5">
            <div className="space-y-3">
              <div className="aspect-square rounded-lg border border-gray-100 bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                <ImageIcon size={42} />
                <span className="text-[11px] mt-2">Imagen no disponible</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-blue-100 bg-blue-50 text-blue-700 text-[11px] text-center py-2 font-semibold"><ImageIcon size={12} className="inline mr-1" />{preview.img_count}</div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 text-gray-700 text-[11px] text-center py-2 font-semibold">+{Math.max(preview.img_count - 1, 0)} fotos</div>
                <div className="rounded-lg border border-red-100 bg-red-50 text-red-700 text-[11px] text-center py-2 font-semibold"><Video size={12} className="inline mr-1" />{preview.video_count}</div>
              </div>
              <div className="rounded-lg border border-gray-100 px-3 py-2 text-[11px] text-gray-600">
                Vendedor / Seller: <span className="font-semibold text-gray-800">Abbott</span>
              </div>
            </div>

            <div className="space-y-4 min-w-0">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-blue-600 font-bold mb-1">Abbott • {preview.categoria || "Sin categoria"}</div>
                <h2 className="text-lg font-bold text-gray-900 leading-snug">{preview.titulo}</h2>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-amber-600 font-semibold"><Star size={13} />{preview.valoracion.toFixed(1)}</span>
                  <span>{preview.reviews.toLocaleString("es-MX")} valoraciones verificadas</span>
                  <span className="font-mono text-gray-600">EAN {preview.ean || "-"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-green-100 bg-green-50 text-center py-3"><div className="text-[10px] font-bold text-green-700">DISPONIBLE</div><div className="text-[9px] text-green-700">DISPONIBILIDAD</div></div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 text-center py-3"><div className="text-lg font-bold text-gray-900">{preview.title_count_characters}</div><div className="text-[9px] text-gray-500">CHARS EN TITULO</div></div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 text-center py-3"><div className="text-lg font-bold text-gray-900">{preview.img_count} / {preview.video_count}</div><div className="text-[9px] text-gray-500">FOTOS / VIDEOS</div></div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 text-center py-3"><div className="text-lg font-bold text-gray-900">{preview.count_character_desc}</div><div className="text-[9px] text-gray-500">CHARS DESCRIPCION</div></div>
              </div>

              <div className="border-l-4 border-sky-400 bg-sky-50/40 rounded-r-lg p-3">
                <div className="flex justify-between gap-3 mb-1">
                  <div className="text-xs font-semibold text-gray-800">Vista previa de descripcion</div>
                  <span className="text-[10px] text-gray-500">{preview.count_character_desc} caracteres</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{preview.count_character_desc > 0 ? "Descripcion detectada durante el scraping. Abrir URL para revisar el contenido completo publicado en retailer." : "No se detecto texto de descripcion en la base scrapeada para este producto."}</p>
              </div>

              <div className="flex items-center justify-between gap-3 bg-slate-900 text-white rounded-lg px-4 py-3 text-xs flex-wrap">
                <span className="inline-flex items-center gap-2 min-w-0"><LinkIcon size={13} /><span className="truncate">URL Scraped: {productUrlHost(preview.url_producto)}</span></span>
                {preview.url_producto ? (
                  <a href={preview.url_producto} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-200 hover:text-white font-semibold">
                    Abrir PDP <ExternalLink size={12} />
                  </a>
                ) : <span className="text-slate-400">Sin URL</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400">{selectedChannel || "Todos"}</div>
            <div className="text-xs text-gray-500 mt-0.5">{sorted.length} productos</div>
          </div>
          <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-lg">
            <button type="button" onClick={() => setTableMode("score")} className={`px-3 py-1 rounded-md text-xs font-medium ${tableMode === "score" ? "bg-purple-600 text-white" : "text-gray-600 hover:text-gray-800"}`}>Producto Score</button>
            <button type="button" onClick={() => setTableMode("content")} className={`px-3 py-1 rounded-md text-xs font-medium ${tableMode === "content" ? "bg-purple-600 text-white" : "text-gray-600 hover:text-gray-800"}`}>Producto Contenido</button>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
            <Search size={12} className="text-gray-400" />
            <input type="text" placeholder="Buscar titulo, EAN, categoria o SKUID..." value={search} onChange={e => setSearch(e.target.value)} className="text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-400 w-60" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm">Sin resultados para los filtros seleccionados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  {tableMode === "score" ? (
                    <>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Posicion</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Titulo</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">EAN</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right"><button type="button" onClick={() => toggleSort("valoracion")} className="hover:text-gray-700">Valoracion{sortMark("valoracion")}</button></th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right"><button type="button" onClick={() => toggleSort("reviews")} className="hover:text-gray-700">Reviews{sortMark("reviews")}</button></th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right"><button type="button" onClick={() => toggleSort("score")} className="hover:text-gray-700">Puntaje{sortMark("score")}</button></th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Vista</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Link</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Titulo</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">EAN</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Canal</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Imagenes</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Video</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Caracteres titulo</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Caracteres descripcion</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right">Puntaje contenido</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Vista</th>
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Link</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((e, i) => (
                  <tr key={`${e.skuid}-${e.canal}-${i}`} className="hover:bg-gray-50">
                    {tableMode === "score" ? (
                      <>
                        <td className="px-3 py-2.5"><span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">#{e.rank}</span></td>
                        <td className="px-3 py-2.5 max-w-md">
                          <div className="font-medium text-gray-800 truncate">{e.titulo}</div>
                          {e.categoria && (
                            <div className="text-[10px] text-gray-500 mt-0.5">{e.categoria}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-gray-700">{e.ean || "-"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full border border-indigo-100">{e.canal}</span></td>
                        <td className="px-3 py-2.5 text-right"><span className="inline-flex items-center gap-1 text-gray-700 font-semibold"><Star size={11} className="text-amber-500" />{e.valoracion.toFixed(1)}</span></td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-800">{e.reviews.toLocaleString("es-MX")}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-purple-700">{e.score.toFixed(2)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><button type="button" onClick={() => setPreviewProduct(e)} className="text-[11px] text-purple-700 font-semibold hover:underline">Vista PDP</button></td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{e.url_producto ? <a href={e.url_producto} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline">Ver producto</a> : <span className="text-[11px] text-gray-400">-</span>}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 max-w-md">
                          <div className="font-medium text-gray-800 truncate">{e.titulo}</div>
                          {e.categoria && (
                            <div className="text-[10px] text-gray-500 mt-0.5">{e.categoria}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-gray-700">{e.ean || "-"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full border border-indigo-100">{e.canal}</span></td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-800">{e.img_count}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-800">{e.video_count}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-800">{e.title_count_characters}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-800">{e.count_character_desc}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-blue-700">{e.content_score.toFixed(0)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><button type="button" onClick={() => setPreviewProduct(e)} className="text-[11px] text-purple-700 font-semibold hover:underline">Vista PDP</button></td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{e.url_producto ? <a href={e.url_producto} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline">Ver producto</a> : <span className="text-[11px] text-gray-400">-</span>}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Glosario ────────────────────────────────────────── */}
      <ContentGlossary />
    </div>
  )
}
