import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ── Palette & Colors ─────────────────────────────────────
const PALETTE = ["#003DA5","#00A3E0","#ef4444","#f59e0b","#06b6d4","#84cc16","#ec4899","#14b8a6","#f97316","#8b5cf6"]
const RETAIL_COLORS: Record<string, string> = {
  AMAZON: "#FF9900", FDA: "#00A650", FSP: "#E31837", WALMART: "#0071CE",
  SAMS: "#0060A9", ML: "#FFE600", BENAVIDES: "#E30613", HEB: "#EE2E24",
  INKAFARMA: "#00A651", MIFARMA: "#E4002B", TOTTUS: "#008C45",
  "CRUZ VERDE": "#00963F", FARMATODO: "#0072BC", RAPPI: "#FF441F",
  "DROGUERIA VIRTUAL": "#4A90D9", "REBAJA VIRTUAL": "#FF6B00",
}
function retailColor(name: string, fallbackIdx: number): string {
  return RETAIL_COLORS[name?.toUpperCase()] || PALETTE[fallbackIdx % PALETTE.length]
}

const FABRICANTE_UNIFIED = `CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END`
const ABBOTT_LIKE = `UPPER(fabricante) LIKE '%ABBOT%'`

// Retail name normalization — maps search table names to canonical SOS names
const RETAIL_NORMALIZE: Record<string, string> = {
  "FARMACIAS BENAVIDES": "BENAVIDES",
  "TU DROGUERIA VIRTUAL": "DROGUERIA VIRTUAL",
}
// Canonical name → all DB aliases to include when filtering
const RETAIL_ALIASES: Record<string, string[]> = {
  "BENAVIDES": ["BENAVIDES", "FARMACIAS BENAVIDES"],
  "DROGUERIA VIRTUAL": ["DROGUERIA VIRTUAL", "TU DROGUERIA VIRTUAL"],
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action  = searchParams.get("action") || "sellers"
  const channel = searchParams.get("channel") || ""
  const search  = searchParams.get("search") || ""   // search term filter (replaces category)
  const seller  = searchParams.get("seller") || ""
  const sellersParam = searchParams.get("sellers")?.split(",").filter(Boolean) || []
  const country = searchParams.get("country") || ""
  const segmento = searchParams.get("segmento") || ""
  const mercado  = searchParams.get("mercado") || ""

  try {
    // ── helper: date params (parsed early for all actions) ──
    const startDate = searchParams.get("startDate") || ""
    const endDate   = searchParams.get("endDate") || ""

    // ── date range — uses MV ──
    if (action === "dates") {
      const [minR] = await prisma.$queryRawUnsafe<{ d: string }[]>(
        `SELECT fecha::text AS d FROM eci.mv_search_daily_fab ORDER BY fecha ASC LIMIT 1`
      )
      const [maxR] = await prisma.$queryRawUnsafe<{ d: string }[]>(
        `SELECT fecha::text AS d FROM eci.mv_search_daily_fab ORDER BY fecha DESC LIMIT 1`
      )
      if (!minR?.d) return NextResponse.json({ min: "", max: "" })
      return NextResponse.json({
        min: minR.d.substring(0, 10),
        max: maxR.d.substring(0, 10),
      })
    }

    const startD = startDate ? new Date(startDate + "T00:00:00Z") : new Date("2000-01-01T00:00:00Z")
    const endD   = endDate   ? new Date(endDate + "T23:59:59Z") : new Date("2099-12-31T23:59:59Z")

    function buildWhere(params: unknown[]) {
      params.push(startD, endD)
      let w = `fecha >= $${params.length - 1} AND fecha <= $${params.length}`
      if (channel) {
        const vals = RETAIL_ALIASES[channel] || [channel]
        if (vals.length === 1) {
          params.push(vals[0]); w += ` AND retail = $${params.length}`
        } else {
          const phs = vals.map(v => { params.push(v); return `$${params.length}` }).join(", ")
          w += ` AND retail IN (${phs})`
        }
      }
      if (search)  { params.push(search);  w += ` AND search = $${params.length}` }
      if (country) { params.push(country); w += ` AND pais = $${params.length}` }
      return w
    }

    function marcaFilter(params: unknown[]): string {
      if (!segmento && !mercado) return ""
      let sub = ` AND marca IN (SELECT mf2.marca FROM eci.marca_fabricante mf2 WHERE 1=1`
      if (segmento) { params.push(segmento); sub += ` AND mf2.segmento = $${params.length}` }
      if (mercado)  { params.push(mercado);  sub += ` AND mf2.mercado = $${params.length}` }
      if (country)  { params.push(country);  sub += ` AND mf2.pais = $${params.length}` }
      sub += ")"
      return sub
    }

    // ── search terms list (replaces "categories") — uses MV ──
    if (action === "searches") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT search AS n FROM eci.mv_search_daily_fab WHERE search IS NOT NULL AND search != ''`
      if (startDate || endDate) { p.push(startD, endD); sql += ` AND fecha >= $${p.length - 1} AND fecha <= $${p.length}` }
      if (channel) { p.push(channel); sql += ` AND retail = $${p.length}` }
      if (country) { p.push(country); sql += ` AND pais = $${p.length}` }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── channels list — uses MV ──
    if (action === "channels") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT retail AS n FROM eci.mv_search_daily_fab WHERE 1=1`
      if (startDate || endDate) { p.push(startD, endD); sql += ` AND fecha >= $${p.length - 1} AND fecha <= $${p.length}` }
      if (search)  { p.push(search);  sql += ` AND search = $${p.length}` }
      if (country) { p.push(country); sql += ` AND pais = $${p.length}` }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      // Normalize names to SOS canonical, deduplicate
      const seen = new Set<string>()
      const normalized = rows
        .map(r => RETAIL_NORMALIZE[r.n] ?? r.n)
        .filter(n => !seen.has(n) && seen.add(n))
        .sort()
      return NextResponse.json(normalized)
    }

    // ── countries list — uses MV ──
    if (action === "countries") {
      const rows = await prisma.$queryRaw<{ n: string }[]>`
        SELECT DISTINCT pais AS n FROM eci.mv_search_daily_fab ORDER BY 1
      `
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── segmentos ──
    if (action === "segmentos") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT segmento AS n FROM eci.marca_fabricante WHERE segmento IS NOT NULL`
      if (country) { p.push(country); sql += ` AND pais = $${p.length}` }
      if (mercado) { p.push(mercado); sql += ` AND mercado = $${p.length}` }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── mercados ──
    if (action === "mercados") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT mercado AS n FROM eci.marca_fabricante WHERE mercado IS NOT NULL`
      if (country)  { p.push(country);  sql += ` AND pais = $${p.length}` }
      if (segmento) { p.push(segmento); sql += ` AND segmento = $${p.length}` }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── sellers list — uses MV ──
    if (action === "sellers_list") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const sql = `SELECT DISTINCT fabricante AS n FROM eci.mv_search_daily_fab WHERE ${w} ORDER BY 1`
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── sellers (fabricante) SOS overview — uses MV ──
    if (action === "sellers") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const sql = `
        WITH agg AS (
          SELECT fabricante AS fab,
            SUM(count_p1) AS products_p1,
            SUM(count_total) AS products_total
          FROM eci.mv_search_daily_fab
          WHERE ${w}
          GROUP BY fabricante
        ),
        totals AS (
          SELECT SUM(products_p1) AS t_p1, SUM(products_total) AS t_all FROM agg
        )
        SELECT a.fab AS seller,
          a.products_p1::int, a.products_total::int,
          ROUND(a.products_p1 * 100.0 / NULLIF(t.t_p1, 0), 2) AS sos_p1,
          ROUND(a.products_total * 100.0 / NULLIF(t.t_all, 0), 2) AS sos_total
        FROM agg a, totals t
        ORDER BY sos_p1 DESC
        LIMIT 50
      `
      const rows = await prisma.$queryRawUnsafe<{
        seller: string; products_p1: number; products_total: number
        sos_p1: number; sos_total: number
      }[]>(sql, ...p)
      return NextResponse.json(rows.map((r, i) => ({
        seller:           r.seller,
        sos_p1:           Number(r.sos_p1),
        sos_total:        Number(r.sos_total),
        sos_p1_change:    0,
        sos_total_change: 0,
        products_p1:      Number(r.products_p1),
        products_total:   Number(r.products_total),
        color:            retailColor(r.seller, i),
        rank:             i + 1,
      })))
    }

    // ── brand breakdown — uses MV marca ──
    if (action === "brands") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p)
      p.push(seller)
      const sellerCond = `fabricante = $${p.length}`
      const mf = marcaFilter(p)
      const sql = `
        WITH agg AS (
          SELECT marca,
            SUM(count_p1) AS products_p1,
            SUM(count_total) AS products_total
          FROM eci.mv_search_daily_marca
          WHERE ${w}${mf} AND ${sellerCond}
          GROUP BY marca
        ),
        totals AS (
          SELECT SUM(products_p1) AS t_p1, SUM(products_total) AS t_all FROM agg
        )
        SELECT a.marca AS brand,
          a.products_p1::int, a.products_total::int,
          ROUND(a.products_p1 * 100.0 / NULLIF(t.t_p1, 0), 2) AS sos_p1,
          ROUND(a.products_total * 100.0 / NULLIF(t.t_all, 0), 2) AS sos_total
        FROM agg a, totals t
        ORDER BY sos_p1 DESC LIMIT 50
      `
      const rows = await prisma.$queryRawUnsafe<{
        brand: string; products_p1: number; products_total: number
        sos_p1: number; sos_total: number
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        brand:            r.brand,
        seller,
        sos_p1:           Number(r.sos_p1),
        sos_total:        Number(r.sos_total),
        sos_p1_change:    0,
        sos_total_change: 0,
        products_p1:      Number(r.products_p1),
      })))
    }

    // ── título breakdown ──
    if (action === "titulos") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p)
      p.push(seller)
      const sellerCond = `${FABRICANTE_UNIFIED} = $${p.length}`
      const mf = marcaFilter(p)
      const sql = `
        WITH base AS (
          SELECT * FROM eci.search WHERE ${w}${mf} AND ${sellerCond} AND pagina <= 3
        ),
        agg AS (
          SELECT COALESCE(ean, skuid) AS titulo_id, MAX(titulo) AS titulo,
            COUNT(*) FILTER (WHERE pagina = 1) AS products_p1,
            COUNT(*) AS products_total,
            MIN(ranking) AS best_ranking
          FROM base GROUP BY COALESCE(ean, skuid)
        ),
        totals AS (
          SELECT SUM(products_p1) AS t_p1, SUM(products_total) AS t_all FROM agg
        )
        SELECT a.titulo_id, a.titulo,
          a.products_p1::int, a.products_total::int,
          a.best_ranking::int,
          ROUND(a.products_p1 * 100.0 / NULLIF(t.t_p1, 0), 2) AS sos_p1,
          ROUND(a.products_total * 100.0 / NULLIF(t.t_all, 0), 2) AS sos_total
        FROM agg a, totals t
        ORDER BY sos_p1 DESC LIMIT 30
      `
      const rows = await prisma.$queryRawUnsafe<{
        titulo_id: string; titulo: string; products_p1: number; products_total: number
        best_ranking: number; sos_p1: number; sos_total: number
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        titulo_id:        r.titulo_id,
        titulo:           r.titulo,
        seller,
        sos_p1:           Number(r.sos_p1),
        sos_total:        Number(r.sos_total),
        sos_p1_change:    0,
        sos_total_change: 0,
        ranking_pos:      r.best_ranking != null ? Number(r.best_ranking) : null,
        products_p1:      Number(r.products_p1),
      })))
    }

    // ── trend (daily SOS by fabricante) — uses MV ──
    if (action === "trend") {
      const sellerList = sellersParam.length ? sellersParam : []
      if (sellerList.length === 0) return NextResponse.json([])
      const page = searchParams.get("page") || "p1"
      const trendStart = new Date(endD.getTime() - 30 * 24 * 60 * 60 * 1000)
      const p: unknown[] = [trendStart, endD]
      let w = `fecha >= $1 AND fecha <= $2`
      if (channel) { p.push(channel); w += ` AND retail = $${p.length}` }
      if (search)  { p.push(search);  w += ` AND search = $${p.length}` }
      if (country) { p.push(country); w += ` AND pais = $${p.length}` }
      const sellerPlaceholders = sellerList.map((_, i) => `$${p.length + i + 1}`).join(", ")
      sellerList.forEach(s => p.push(s))
      const sql = `
        WITH daily_total AS (
          SELECT fecha AS day, SUM(count_p1) AS total_p1, SUM(count_total) AS total_all
          FROM eci.mv_search_daily_fab WHERE ${w}
          GROUP BY fecha
        ),
        seller_daily AS (
          SELECT fecha AS day, fabricante AS fab, SUM(count_p1) AS products_p1, SUM(count_total) AS products_total
          FROM eci.mv_search_daily_fab WHERE ${w} AND fabricante IN (${sellerPlaceholders})
          GROUP BY fecha, fabricante
        )
        SELECT sd.day::text, sd.fab AS seller,
          ROUND(sd.products_p1 * 100.0 / NULLIF(dt.total_p1, 0), 2) AS sos_p1,
          ROUND(sd.products_total * 100.0 / NULLIF(dt.total_all, 0), 2) AS sos_total
        FROM seller_daily sd
        JOIN daily_total dt ON sd.day = dt.day
        ORDER BY sd.day, sd.fab
      `
      const rows = await prisma.$queryRawUnsafe<{ day: string; seller: string; sos_p1: number; sos_total: number }[]>(sql, ...p)
      const dayMap = new Map<string, Record<string, unknown>>()
      rows.forEach(r => {
        if (!dayMap.has(r.day)) dayMap.set(r.day, { week: r.day })
        dayMap.get(r.day)![r.seller] = page === "p1" ? Number(r.sos_p1) : Number(r.sos_total)
      })
      return NextResponse.json(Array.from(dayMap.values()))
    }

    // ── by_channel (SOS per retail for a given seller) — uses MV ──
    if (action === "by_channel") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      p.push(startD, endD)
      let w = `fecha >= $${p.length - 1} AND fecha <= $${p.length}`
      if (search)  { p.push(search);  w += ` AND search = $${p.length}` }
      if (country) { p.push(country); w += ` AND pais = $${p.length}` }
      p.push(seller)
      const sellerIdx = p.length
      const sql = `
        WITH per_retail AS (
          SELECT retail,
            SUM(count_p1) AS total_p1,
            SUM(count_total) AS total_all,
            SUM(count_p1) FILTER (WHERE fabricante = $${sellerIdx}) AS seller_p1,
            SUM(count_total) FILTER (WHERE fabricante = $${sellerIdx}) AS seller_all
          FROM eci.mv_search_daily_fab WHERE ${w}
          GROUP BY retail
        )
        SELECT retail AS channel,
          ROUND(seller_p1 * 100.0 / NULLIF(total_p1, 0), 2) AS sos_p1,
          ROUND(seller_all * 100.0 / NULLIF(total_all, 0), 2) AS sos_total
        FROM per_retail
        WHERE seller_p1 > 0
        ORDER BY sos_p1 DESC
      `
      const rows = await prisma.$queryRawUnsafe<{ channel: string; sos_p1: number; sos_total: number }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        channel:          RETAIL_NORMALIZE[r.channel] ?? r.channel,
        sos_p1:           Number(r.sos_p1),
        sos_total:        Number(r.sos_total),
        sos_p1_change:    0,
        sos_total_change: 0,
      })))
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err: unknown) {
    console.error("[api/search] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
