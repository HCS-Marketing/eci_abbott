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

    // ── date range ──
    if (action === "dates") {
      const p: unknown[] = []
      let sql = `SELECT MIN(fecha)::text AS min_d, MAX(fecha)::text AS max_d FROM eci.search WHERE 1=1`
      if (channel) { p.push(channel); sql += ` AND retail = $${p.length}` }
      if (country) { p.push(country); sql += ` AND pais = $${p.length}` }
      const [r] = await prisma.$queryRawUnsafe<{ min_d: string; max_d: string }[]>(sql, ...p)
      if (!r?.min_d) return NextResponse.json({ min: "", max: "" })
      return NextResponse.json({
        min: r.min_d.substring(0, 10),
        max: r.max_d.substring(0, 10),
      })
    }

    const startD = startDate ? new Date(startDate + "T00:00:00Z") : new Date("2000-01-01T00:00:00Z")
    const endD   = endDate   ? new Date(endDate + "T23:59:59Z") : new Date("2099-12-31T23:59:59Z")

    // When no search term is selected and the date range is wide (>14 days),
    // limit to last 7 days from endD to avoid scanning millions of rows
    const effectiveStartD = (!search && (endD.getTime() - startD.getTime()) > 14 * 86400000)
      ? new Date(endD.getTime() - 7 * 86400000)
      : startD

    function buildWhere(params: unknown[]) {
      params.push(effectiveStartD, endD)
      let w = `fecha >= $${params.length - 1} AND fecha <= $${params.length}`
      if (channel) { params.push(channel); w += ` AND retail = $${params.length}` }
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

    // ── search terms list (replaces "categories") ──
    if (action === "searches") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT search AS n FROM eci.search WHERE search IS NOT NULL AND search != ''`
      if (startDate || endDate) { p.push(startD, endD); sql += ` AND fecha >= $${p.length - 1} AND fecha <= $${p.length}` }
      if (channel) { p.push(channel); sql += ` AND retail = $${p.length}` }
      if (country) { p.push(country); sql += ` AND pais = $${p.length}` }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── channels list ──
    if (action === "channels") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT retail AS n FROM eci.search WHERE 1=1`
      if (startDate || endDate) { p.push(startD, endD); sql += ` AND fecha >= $${p.length - 1} AND fecha <= $${p.length}` }
      if (search)  { p.push(search);  sql += ` AND search = $${p.length}` }
      if (country) { p.push(country); sql += ` AND pais = $${p.length}` }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── countries list ──
    if (action === "countries") {
      const rows = await prisma.$queryRaw<{ n: string }[]>`
        SELECT DISTINCT pais AS n FROM eci.search ORDER BY 1
      `
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── segmentos ──
    if (action === "segmentos") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT segmento AS n FROM eci.marca_fabricante WHERE segmento IS NOT NULL`
      if (country) { p.push(country); sql += ` AND pais = $${p.length}` }
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

    // ── sellers list ──
    if (action === "sellers_list") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const mf = marcaFilter(p)
      const sql = `SELECT DISTINCT ${FABRICANTE_UNIFIED} AS n FROM eci.search WHERE ${w}${mf} AND pagina = 1 ORDER BY 1`
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── sellers (fabricante) SOS overview ──
    if (action === "sellers") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const mf = marcaFilter(p)
      const sql = `
        WITH agg AS (
          SELECT ${FABRICANTE_UNIFIED} AS fab,
            COUNT(*) FILTER (WHERE pagina = 1) AS products_p1,
            COUNT(*) AS products_total
          FROM eci.search
          WHERE ${w}${mf} AND pagina <= 3
          GROUP BY fab
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

    // ── brand breakdown ──
    if (action === "brands") {
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
          SELECT marca,
            COUNT(*) FILTER (WHERE pagina = 1) AS products_p1,
            COUNT(*) AS products_total
          FROM base GROUP BY marca
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

    // ── trend (daily SOS by fabricante) — limited to last 30 days for performance ──
    if (action === "trend") {
      const sellerList = sellersParam.length ? sellersParam : []
      if (sellerList.length === 0) return NextResponse.json([])
      // Limit trend to last 30 days of endD for performance on 10M row table
      const trendStart = new Date(endD.getTime() - 30 * 24 * 60 * 60 * 1000)
      const p: unknown[] = [trendStart, endD]
      let w = `fecha >= $1 AND fecha <= $2`
      if (channel) { p.push(channel); w += ` AND retail = $${p.length}` }
      if (search)  { p.push(search);  w += ` AND search = $${p.length}` }
      if (country) { p.push(country); w += ` AND pais = $${p.length}` }
      const mf = marcaFilter(p)
      const sellerPlaceholders = sellerList.map((_, i) => `$${p.length + i + 1}`).join(", ")
      sellerList.forEach(s => p.push(s))
      const sql = `
        WITH base AS (
          SELECT fecha::date AS day, pagina,
            ${FABRICANTE_UNIFIED} AS fab
          FROM eci.search WHERE ${w}${mf} AND pagina = 1
        ),
        daily_total AS (
          SELECT day, COUNT(*) AS total_p1 FROM base GROUP BY day
        ),
        seller_daily AS (
          SELECT day, fab, COUNT(*) AS products_p1
          FROM base WHERE fab IN (${sellerPlaceholders})
          GROUP BY day, fab
        )
        SELECT sd.day::text, sd.fab AS seller,
          ROUND(sd.products_p1 * 100.0 / NULLIF(dt.total_p1, 0), 2) AS sos_p1
        FROM seller_daily sd
        JOIN daily_total dt ON sd.day = dt.day
        ORDER BY sd.day, sd.fab
      `
      const rows = await prisma.$queryRawUnsafe<{ day: string; seller: string; sos_p1: number }[]>(sql, ...p)
      const dayMap = new Map<string, Record<string, unknown>>()
      rows.forEach(r => {
        if (!dayMap.has(r.day)) dayMap.set(r.day, { week: r.day })
        dayMap.get(r.day)![r.seller] = Number(r.sos_p1)
      })
      return NextResponse.json(Array.from(dayMap.values()))
    }

    // ── by_channel (SOS per retail for a given seller) ──
    if (action === "by_channel") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      // build where WITHOUT channel filter
      p.push(effectiveStartD, endD)
      let w = `fecha >= $${p.length - 1} AND fecha <= $${p.length}`
      if (search)  { p.push(search);  w += ` AND search = $${p.length}` }
      if (country) { p.push(country); w += ` AND pais = $${p.length}` }
      const mf = marcaFilter(p)
      p.push(seller)
      const sellerIdx = p.length
      const sql = `
        WITH per_retail AS (
          SELECT retail,
            COUNT(*) FILTER (WHERE pagina = 1) AS total_p1,
            COUNT(*) AS total_all,
            COUNT(*) FILTER (WHERE pagina = 1 AND ${FABRICANTE_UNIFIED} = $${sellerIdx}) AS seller_p1,
            COUNT(*) FILTER (WHERE ${FABRICANTE_UNIFIED} = $${sellerIdx}) AS seller_all
          FROM eci.search WHERE ${w}${mf} AND pagina <= 3
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
        channel:          r.channel,
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
