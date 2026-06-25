import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// ── COLUMN MAPPING ──────────────────────────────────────────
// Abbott DB (eci.sos) columns:
//   id, pais, fecha, titulo, ean, marca, precio_venta, precio_neto,
//   promocion, descuento, categoria, subcategoria, subcategoria_1,
//   retail, skuid, orden, ranking, pagina, en_stock, url_producto,
//   fabricante, presentacion, fidelizacion, imagen
//
// App concept → DB column:
//   seller       → fabricante (unified)
//   brand        → marca
//   channel      → retail
//   producto     → titulo
//   precio       → precio_neto
// ─────────────────────────────────────────────────────────────

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

// SQL CASE to unify Abbott fabricante variants into "ABBOTT"
const FABRICANTE_UNIFIED = `CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END`

// Abbott fabricante identifiers
const ABBOTT_LIKE = `UPPER(fabricante) LIKE '%ABBOT%'`

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action   = searchParams.get("action") || "sellers"
  const channel  = searchParams.get("channel") || ""
  const category = searchParams.get("category") || ""
  const seller   = searchParams.get("seller") || ""
  const sellersParam = searchParams.get("sellers")?.split(",").filter(Boolean) || []
  const country  = searchParams.get("country") || ""
  const segmento = searchParams.get("segmento") || ""
  const mercado  = searchParams.get("mercado") || ""
  const pageMode = (searchParams.get("page") || "p1") === "p1" ? "p1" : "total"
  // When page=p1, skip rows that have no page-1 appearances. Pure perf optimization
  // for SOS daily MVs (count_p1/count_total) — sos_p1 math is unchanged because
  // count_p1=0 rows contribute 0 to both numerator and denominator.
  const sosPageFilter = pageMode === "p1" ? " AND count_p1 > 0" : ""
  // Same idea for ranking MVs (sum_ranking_p1/sum_ranking_total).
  const rankPageFilter = pageMode === "p1" ? " AND sum_ranking_p1 > 0" : ""

  try {
    // ── date range (from mv_sos_dimensions — 83 rows) ────
    if (action === "dates") {
      if (channel) {
        const rows = await prisma.$queryRawUnsafe<{ min_d: Date; max_d: Date }[]>(
          `SELECT MIN(min_fecha) AS min_d, MAX(max_fecha) AS max_d FROM eci.mv_sos_dimensions WHERE retail = $1`,
          channel
        )
        const r = rows[0]
        if (!r?.min_d) return NextResponse.json({ min: "", max: "" })
        return NextResponse.json({
          min: r.min_d.toISOString().split("T")[0],
          max: r.max_d.toISOString().split("T")[0],
        })
      }
      const [r] = await prisma.$queryRaw<{ min_d: Date; max_d: Date }[]>`
        SELECT MIN(min_fecha) AS min_d, MAX(max_fecha) AS max_d FROM eci.mv_sos_dimensions
      `
      return NextResponse.json({
        min: r.min_d.toISOString().split("T")[0],
        max: r.max_d.toISOString().split("T")[0],
      })
    }

    // ── helper: parse date params ─────────────────────────
    const startDate = searchParams.get("startDate") || ""
    const endDate   = searchParams.get("endDate")   || ""
    const startD = startDate ? new Date(startDate + "T00:00:00Z") : new Date("2000-01-01T00:00:00Z")
    const endD   = endDate   ? new Date(endDate   + "T23:59:59Z") : new Date("2099-12-31T23:59:59Z")

    function buildWhere(
      params: unknown[],
      opts: { channel?: boolean; category?: boolean; country?: boolean } = { channel: true, category: true, country: true }
    ) {
      params.push(startD, endD)
      let w = `fecha >= $${params.length - 1} AND fecha <= $${params.length}`
      if (opts.channel !== false && channel) {
        params.push(channel)
        w += ` AND retail = $${params.length}`
      }
      if (opts.category !== false && category) {
        params.push(category)
        w += ` AND categoria = $${params.length}`
      }
      if (opts.country !== false && country) {
        params.push(country)
        w += ` AND pais = $${params.length}`
      }
      return w
    }

    // ── sellers list (fabricantes unified) — from MV ──────
    if (action === "sellers_list") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const sql = `SELECT DISTINCT fabricante AS n FROM eci.mv_sos_daily_fab WHERE ${w} ORDER BY 1`
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── fabricantes list for inventory filter — from eci.sos ─
    if (action === "fabricantes_inv") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT ${FABRICANTE_UNIFIED} AS n FROM eci.sos WHERE fabricante IS NOT NULL`
      if (country)  { p.push(country);  sql += ` AND pais = $${p.length}` }
      if (channel)  { p.push(channel);  sql += ` AND retail = $${p.length}` }
      if (category) { p.push(category); sql += ` AND categoria = $${p.length}` }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── categories list — from mv_sos_dimensions ──────────
    if (action === "categories") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT categoria AS n FROM eci.mv_sos_dimensions WHERE 1=1`
      if (channel) { p.push(channel); sql += ` AND retail = $${p.length}` }
      if (country) { p.push(country); sql += ` AND pais = $${p.length}` }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── channels list (retailers) — from mv_sos_dimensions ─
    if (action === "channels") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT retail AS n FROM eci.mv_sos_dimensions WHERE 1=1`
      if (category) { p.push(category); sql += ` AND categoria = $${p.length}` }
      if (country)  { p.push(country);  sql += ` AND pais = $${p.length}` }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── countries list — from mv_sos_dimensions ───────────
    if (action === "countries") {
      const rows = await prisma.$queryRaw<{ n: string }[]>`
        SELECT DISTINCT pais AS n FROM eci.mv_sos_dimensions ORDER BY 1
      `
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── segmentos list — from marca_fabricante ────────────
    // Combine channel + country filters via a fabricante sub-query against mv_sos_daily_fab.
    if (action === "segmentos") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT segmento AS n FROM eci.marca_fabricante WHERE segmento IS NOT NULL AND fabricante != 'MARCA LOCAL'`
      if (mercado) { p.push(mercado); sql += ` AND mercado = $${p.length}` }
      if (channel || country) {
        const sub: string[] = []
        if (channel) { p.push(channel); sub.push(`retail = $${p.length}`) }
        if (country) { p.push(country); sub.push(`pais = $${p.length}`) }
        sql += ` AND fabricante IN (SELECT DISTINCT fabricante FROM eci.mv_sos_daily_fab WHERE ${sub.join(" AND ")})`
      }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── mercados list — from marca_fabricante ─────────────
    // Combine channel + country filters via a fabricante sub-query against mv_sos_daily_fab.
    if (action === "mercados") {
      const p: unknown[] = []
      let sql = `SELECT DISTINCT mercado AS n FROM eci.marca_fabricante WHERE mercado IS NOT NULL AND fabricante != 'MARCA LOCAL'`
      if (segmento) { p.push(segmento); sql += ` AND segmento = $${p.length}` }
      if (channel || country) {
        const sub: string[] = []
        if (channel) { p.push(channel); sub.push(`retail = $${p.length}`) }
        if (country) { p.push(country); sub.push(`pais = $${p.length}`) }
        sql += ` AND fabricante IN (SELECT DISTINCT fabricante FROM eci.mv_sos_daily_fab WHERE ${sub.join(" AND ")})`
      }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // Helper: build segmento/mercado filter for queries with a table alias.
    // Filters by fabricante (not marca) because marca values in marca_fabricante
    // are product-line names (e.g. "ENFAMIL CONFORT 1") while marca in the MVs
    // is the brand family (e.g. "ENFAMIL"), so a marca-IN match drops most rows.
    function marcaFilterSQL(params: unknown[], tableAlias: string): string {
      if (!segmento && !mercado) return ""
      let sub = ` AND ${tableAlias}.fabricante IN (SELECT DISTINCT mf2.fabricante FROM eci.marca_fabricante mf2 WHERE 1=1`
      if (segmento) { params.push(segmento); sub += ` AND mf2.segmento = $${params.length}` }
      if (mercado)  { params.push(mercado);  sub += ` AND mf2.mercado = $${params.length}` }
      sub += ")"
      return sub
    }

    // For titulo MVs (no marca column) — filter by fabricante instead
    function fabricanteFilterSQL(params: unknown[], tableAlias: string): string {
      if (!segmento && !mercado) return ""
      let sub = ` AND ${tableAlias}.fabricante IN (SELECT DISTINCT mf2.fabricante FROM eci.marca_fabricante mf2 WHERE 1=1`
      if (segmento) { params.push(segmento); sub += ` AND mf2.segmento = $${params.length}` }
      if (mercado)  { params.push(mercado);  sub += ` AND mf2.mercado = $${params.length}` }
      sub += ")"
      return sub
    }

    // Simpler version for queries without table alias (same semantics: filter by fabricante)
    function marcaFilter(params: unknown[]): string {
      if (!segmento && !mercado) return ""
      let sub = ` AND fabricante IN (SELECT DISTINCT mf2.fabricante FROM eci.marca_fabricante mf2 WHERE 1=1`
      if (segmento) { params.push(segmento); sub += ` AND mf2.segmento = $${params.length}` }
      if (mercado)  { params.push(mercado);  sub += ` AND mf2.mercado = $${params.length}` }
      sub += ")"
      return sub
    }

    // ── sellers (fabricante) SOS overview ──────────────────
    if (action === "sellers") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const mf = marcaFilterSQL(p, "d")
      // When segmento/mercado is active, use mv_sos_daily_marca (has marca column)
      const table = (segmento || mercado) ? "eci.mv_sos_daily_marca" : "eci.mv_sos_daily_fab"
      const sql = `
        WITH agg AS (
          SELECT fabricante AS fab,
            SUM(count_p1) AS products_p1,
            SUM(count_total) AS products_total
          FROM ${table} d WHERE ${w}${mf}${sosPageFilter}
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
        products_p1:      Number(r.products_p1),
        products_total:   Number(r.products_total),
        color:            retailColor(r.seller, i),
        rank:             i + 1,
      })))
    }

    // ── brand-level breakdown — from mv_sos_daily_marca ────
    if (action === "brands") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const mf = marcaFilterSQL(p, "d")
      const sql = `
        WITH agg AS (
          SELECT marca,
            fabricante AS seller,
            SUM(count_p1) AS products_p1,
            SUM(count_total) AS products_total
          FROM eci.mv_sos_daily_marca d
          WHERE ${w}${mf}${sosPageFilter}
            AND marca IS NOT NULL AND TRIM(marca) <> ''
            AND NOT (LOWER(TRIM(marca)) = 'nan' AND fabricante <> 'NESTLE')
          GROUP BY marca, fabricante
        ),
        totals AS (
          SELECT SUM(products_p1) AS t_p1, SUM(products_total) AS t_all FROM agg
        )
        SELECT a.marca AS brand,
          a.seller,
          a.products_p1::int, a.products_total::int,
          ROUND(a.products_p1 * 100.0 / NULLIF(t.t_p1, 0), 2) AS sos_p1,
          ROUND(a.products_total * 100.0 / NULLIF(t.t_all, 0), 2) AS sos_total
        FROM agg a, totals t
        ORDER BY sos_p1 DESC
        LIMIT 50
      `
      const rows = await prisma.$queryRawUnsafe<{
        brand: string; seller: string; products_p1: number; products_total: number
        sos_p1: number; sos_total: number
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        brand:            r.brand,
        seller:           r.seller,
        sos_p1:           Number(r.sos_p1),
        sos_total:        Number(r.sos_total),
        products_p1:      Number(r.products_p1),
      })))
    }

    // ── título breakdown (by fabricante) ────────────────────
    if (action === "titulos") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const mf = fabricanteFilterSQL(p, "d")
      const sql = `
        WITH agg AS (
          SELECT COALESCE(producto_id::text, titulo) AS titulo_id,
            MAX(titulo) AS titulo,
            fabricante AS seller,
            SUM(count_p1) AS products_p1,
            SUM(count_total) AS products_total,
            MIN(best_ranking) AS best_ranking
          FROM eci.mv_sos_daily_titulo d
          WHERE ${w}${mf}${sosPageFilter}
          GROUP BY COALESCE(producto_id::text, titulo), fabricante
        ),
        totals AS (
          SELECT SUM(products_p1) AS t_p1, SUM(products_total) AS t_all FROM agg
        ),
        ean_map AS (
          SELECT id::text AS pid, MAX(ean) AS ean
          FROM eci.sos
          WHERE id::text IN (SELECT titulo_id FROM agg) AND ean IS NOT NULL
          GROUP BY id
        )
        SELECT a.titulo_id, a.titulo, a.seller,
          a.products_p1::int, a.products_total::int,
          a.best_ranking::int,
          ROUND(a.products_p1 * 100.0 / NULLIF(t.t_p1, 0), 2) AS sos_p1,
          ROUND(a.products_total * 100.0 / NULLIF(t.t_all, 0), 2) AS sos_total,
          COALESCE(em.ean, pm.ean) AS ean,
          pm.local_sku, pm.asin, pm.meli_id, pm.sap_sku
        FROM agg a
        CROSS JOIN totals t
        LEFT JOIN ean_map em ON em.pid = a.titulo_id
        LEFT JOIN eci.products_master pm ON pm.ean = COALESCE(em.ean, a.titulo_id)
        ORDER BY sos_p1 DESC LIMIT 30
      `
      const rows = await prisma.$queryRawUnsafe<{
        titulo_id: string; titulo: string; seller: string; products_p1: number; products_total: number
        best_ranking: number; sos_p1: number; sos_total: number
        ean: string | null; local_sku: string | null; asin: string | null
        meli_id: string | null; sap_sku: string | null
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        titulo_id:        r.titulo_id,
        titulo:           r.titulo,
        seller:           r.seller,
        sos_p1:           Number(r.sos_p1),
        sos_total:        Number(r.sos_total),
        ranking_pos:      r.best_ranking != null ? Number(r.best_ranking) : null,
        products_p1:      Number(r.products_p1),
        ean:              r.ean,
        sku:              r.local_sku || r.sap_sku,
        meli_id:          r.meli_id,
        asin:             r.asin,
      })))
    }

    // ── trend diario — from mv_sos_daily_fab ──────────────
    if (action === "trend") {
      const sellerList = sellersParam.length ? sellersParam : []
      if (sellerList.length === 0) return NextResponse.json([])
      const page = searchParams.get("page") || "p1"
      const p: unknown[] = []
      const w = buildWhere(p)
      const mf = marcaFilterSQL(p, "d")
      const sellerPlaceholders = sellerList.map((_, i) => `$${p.length + i + 1}`).join(", ")
      sellerList.forEach(s => p.push(s))
      const table = (segmento || mercado) ? "eci.mv_sos_daily_marca" : "eci.mv_sos_daily_fab"
      const sql = `
        WITH daily_total AS (
          SELECT fecha AS day, SUM(count_p1) AS total_p1, SUM(count_total) AS total_all
          FROM ${table} d WHERE ${w}${mf}${sosPageFilter}
          GROUP BY fecha
        ),
        seller_daily AS (
          SELECT fecha AS day, fabricante AS fab, SUM(count_p1) AS products_p1, SUM(count_total) AS products_total
          FROM ${table} d
          WHERE ${w}${mf} AND fabricante IN (${sellerPlaceholders})${sosPageFilter}
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

    // ── SOS by channel — from mv_sos_daily_fab ───────────
    if (action === "by_channel") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p, { channel: false, category: true, country: true })
      const mf = marcaFilterSQL(p, "d")
      p.push(seller)
      const table = (segmento || mercado) ? "eci.mv_sos_daily_marca" : "eci.mv_sos_daily_fab"
      const sql = `
        WITH per_retail AS (
          SELECT retail,
            SUM(count_p1) AS total_p1,
            SUM(count_total) AS total_all,
            SUM(CASE WHEN fabricante = $${p.length} THEN count_p1 ELSE 0 END) AS seller_p1,
            SUM(CASE WHEN fabricante = $${p.length} THEN count_total ELSE 0 END) AS seller_all
          FROM ${table} d WHERE ${w}${mf}${sosPageFilter}
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
      })))
    }

    // ── rank_sellers — SUM(ranking) per fabricante ───────
    if (action === "rank_sellers") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const mf = marcaFilterSQL(p, "d")
      const table = (segmento || mercado) ? "eci.mv_ranking_daily_marca" : "eci.mv_ranking_daily_fab"
      const sql = `
        SELECT
          fabricante AS seller,
          SUM(sum_ranking_p1)    AS score_p1,
          SUM(sum_ranking_total) AS score_total
        FROM ${table} d WHERE ${w}${mf}${rankPageFilter}
        GROUP BY fabricante
        ORDER BY score_p1 DESC
        LIMIT 50
      `
      const rows = await prisma.$queryRawUnsafe<{ seller: string; score_p1: number; score_total: number }[]>(sql, ...p)
      return NextResponse.json(rows.map((r, i) => ({
        seller:       r.seller,
        score_p1:     Math.round(Number(r.score_p1)),
        score_total:  Math.round(Number(r.score_total)),
        color:        retailColor(r.seller, i),
        rank:         i + 1,
      })))
    }

    // ── rank_brands — SUM(ranking) per marca ─────────────
    if (action === "rank_brands") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const mf = marcaFilterSQL(p, "d")
      const sql = `
        SELECT
          marca,
          fabricante AS seller,
          SUM(sum_ranking_p1)    AS score_p1,
          SUM(sum_ranking_total) AS score_total
        FROM eci.mv_ranking_daily_marca d
        WHERE ${w}${mf}${rankPageFilter}
          AND marca IS NOT NULL AND TRIM(marca) <> ''
          AND NOT (LOWER(TRIM(marca)) = 'nan' AND fabricante <> 'NESTLE')
        GROUP BY marca, fabricante
        ORDER BY score_p1 DESC
        LIMIT 50
      `
      const rows = await prisma.$queryRawUnsafe<{ marca: string; seller: string; score_p1: number; score_total: number }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        brand:       r.marca,
        seller:      r.seller,
        score_p1:    Math.round(Number(r.score_p1)),
        score_total: Math.round(Number(r.score_total)),
      })))
    }

    // ── rank_titulos — SUM(ranking) per titulo ────────────
    if (action === "rank_titulos") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const mf = fabricanteFilterSQL(p, "d")
      const sql = `
        WITH agg AS (
          SELECT
            titulo_id,
            MAX(titulo)            AS titulo,
            fabricante             AS seller,
            SUM(sum_ranking_p1)    AS score_p1,
            SUM(sum_ranking_total) AS score_total
          FROM eci.mv_ranking_daily_titulo d
          WHERE ${w}${mf}${rankPageFilter}
          GROUP BY titulo_id, fabricante
        ),
        ean_map AS (
          SELECT id::text AS pid, MAX(ean) AS ean
          FROM eci.sos
          WHERE id::text IN (SELECT titulo_id::text FROM agg) AND ean IS NOT NULL
          GROUP BY id
        )
        SELECT a.titulo_id, a.titulo, a.seller, a.score_p1, a.score_total,
          COALESCE(em.ean, pm.ean) AS ean,
          pm.local_sku, pm.asin, pm.meli_id, pm.sap_sku
        FROM agg a
        LEFT JOIN ean_map em ON em.pid = a.titulo_id::text
        LEFT JOIN eci.products_master pm ON pm.ean = COALESCE(em.ean, a.titulo_id::text)
        ORDER BY score_p1 DESC
        LIMIT 30
      `
      const rows = await prisma.$queryRawUnsafe<{
        titulo_id: string; titulo: string; seller: string; score_p1: number; score_total: number
        ean: string | null; local_sku: string | null; asin: string | null
        meli_id: string | null; sap_sku: string | null
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        titulo_id:   r.titulo_id,
        titulo:      r.titulo,
        seller:      r.seller,
        score_p1:    Math.round(Number(r.score_p1)),
        score_total: Math.round(Number(r.score_total)),
        ean:         r.ean,
        sku:         r.local_sku || r.sap_sku,
        meli_id:     r.meli_id,
        asin:        r.asin,
      })))
    }

    // ── rank_trend — daily SUM(ranking) per fabricante ───
    if (action === "rank_trend") {
      const sellerList = sellersParam.length ? sellersParam : []
      if (sellerList.length === 0) return NextResponse.json([])
      const page = searchParams.get("page") || "p1"
      const p: unknown[] = []
      const w = buildWhere(p)
      const mf = marcaFilterSQL(p, "d")
      const sellerPlaceholders = sellerList.map((_, i) => `$${p.length + i + 1}`).join(", ")
      sellerList.forEach(s => p.push(s))
      const table = (segmento || mercado) ? "eci.mv_ranking_daily_marca" : "eci.mv_ranking_daily_fab"
      const sql = `
        SELECT fecha::text AS day, fabricante AS seller,
          SUM(sum_ranking_p1) AS score_p1,
          SUM(sum_ranking_total) AS score_total
        FROM ${table} d
        WHERE ${w}${mf} AND fabricante IN (${sellerPlaceholders})${rankPageFilter}
        GROUP BY fecha, fabricante
        ORDER BY fecha, fabricante
      `
      const rows = await prisma.$queryRawUnsafe<{ day: string; seller: string; score_p1: number; score_total: number }[]>(sql, ...p)
      const dayMap = new Map<string, Record<string, unknown>>()
      rows.forEach(r => {
        if (!dayMap.has(r.day)) dayMap.set(r.day, { week: r.day })
        dayMap.get(r.day)![r.seller] = page === "p1" ? Math.round(Number(r.score_p1)) : Math.round(Number(r.score_total))
      })
      return NextResponse.json(Array.from(dayMap.values()))
    }

    // ── rank_by_channel — SUM(ranking) per retail for one seller ──
    if (action === "rank_by_channel") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p, { channel: false, category: true, country: true })
      const mf = marcaFilterSQL(p, "d")
      p.push(seller)
      const table = (segmento || mercado) ? "eci.mv_ranking_daily_marca" : "eci.mv_ranking_daily_fab"
      const sql = `
        SELECT retail AS channel,
          SUM(CASE WHEN fabricante = $${p.length} THEN sum_ranking_p1    ELSE 0 END) AS seller_p1,
          SUM(CASE WHEN fabricante = $${p.length} THEN sum_ranking_total  ELSE 0 END) AS seller_total
        FROM ${table} d WHERE ${w}${mf}${rankPageFilter}
        GROUP BY retail
        HAVING SUM(CASE WHEN fabricante = $${p.length} THEN sum_ranking_p1 ELSE 0 END) > 0
        ORDER BY seller_p1 DESC
      `
      const rows = await prisma.$queryRawUnsafe<{ channel: string; seller_p1: number; seller_total: number }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        channel:      r.channel,
        score_p1:     Math.round(Number(r.seller_p1)),
        score_total:  Math.round(Number(r.seller_total)),
      })))
    }

    // ── ranking — from mv_sos_product_latest ────────────
    if (action === "ranking") {
      const pageFilter = searchParams.get("page_filter") || "all"
      const limit = Math.min(200, parseInt(searchParams.get("limit") || "50", 10))
      const p: unknown[] = []
      const w = buildWhere(p)
      const pageClause = pageFilter === "p1" ? "AND appearances_p1 > 0" : ""
      let sellerCond = ""
      if (seller) {
        p.push(seller); sellerCond = ` AND fabricante = $${p.length}`
      }
      const mfRank = marcaFilter(p)
      const sql = `
        SELECT
          producto_id AS id,
          MAX(titulo) AS titulo,
          MAX(marca) AS marca,
          MAX(retail) AS seller,
          MAX(fabricante) AS fabricante,
          MIN(best_ranking) AS best_ranking,
          SUM(appearances_p1)::int AS appearances_p1,
          SUM(appearances_total)::int AS appearances_total
        FROM eci.mv_sos_product_latest
        WHERE ${w} ${pageClause} AND producto_id IS NOT NULL AND best_ranking IS NOT NULL ${sellerCond}${mfRank}
        GROUP BY producto_id
        ORDER BY best_ranking ASC
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; titulo: string; marca: string; seller: string; fabricante: string
        best_ranking: number; appearances_p1: number; appearances_total: number
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        id:               r.id,
        titulo:           r.titulo,
        marca:            r.marca,
        seller:           r.seller,
        fabricante:       r.fabricante,
        ranking:          Number(r.best_ranking),
        appearances_p1:   Number(r.appearances_p1),
        appearances_total: Number(r.appearances_total),
      })))
    }

    // ── bestsellers — from mv_sos_product_latest ─────────
    if (action === "bestsellers") {
      const pageFilter = searchParams.get("page_filter") || "p1"
      const limit = Math.min(100, parseInt(searchParams.get("limit") || "20", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const p: unknown[] = [dateParam]
      let w = `fecha = $1::date`
      if (channel)  { p.push(channel);  w += ` AND retail = $${p.length}` }
      if (category) { p.push(category); w += ` AND categoria = $${p.length}` }
      if (country)  { p.push(country);  w += ` AND pais = $${p.length}` }
      const pageClause = pageFilter === "p1" ? "AND appearances_p1 > 0" : ""
      let sellerCond = ""
      if (seller) {
        p.push(seller); sellerCond = ` AND fabricante = $${p.length}`
      }
      const mfBest = marcaFilter(p)
      const sql = `
        SELECT
          producto_id AS id,
          titulo,
          marca,
          retail AS seller,
          fabricante,
          categoria,
          retail,
          ROUND(precio_venta::numeric, 0) AS precio_venta,
          ROUND(precio_neto::numeric, 0) AS precio_neto,
          ROUND(descuento::numeric, 1) AS descuento,
          url_producto,
          presentacion,
          promocion,
          best_ranking,
          appearances_p1::int AS appearances_p1,
          appearances_total::int AS appearances_total
        FROM eci.mv_sos_product_latest
        WHERE ${w} ${pageClause} AND producto_id IS NOT NULL AND best_ranking IS NOT NULL ${sellerCond}${mfBest}
        ORDER BY best_ranking ASC
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; titulo: string; marca: string; seller: string; fabricante: string
        categoria: string; retail: string
        precio_venta: number; precio_neto: number; descuento: number
        url_producto: string; presentacion: string; promocion: string
        best_ranking: number; appearances_p1: number; appearances_total: number
      }[]>(sql, ...p)
      return NextResponse.json(rows.map((r, i) => ({
        id:                r.id,
        rank:              i + 1,
        titulo:            r.titulo,
        marca:             r.marca,
        seller:            r.seller,
        fabricante:        r.fabricante,
        subcategoria:      r.categoria,
        plataforma:        r.retail,
        precio_venta:      Number(r.precio_venta),
        precio:            r.precio_neto != null ? Number(r.precio_neto) : null,
        descuento:         Number(r.descuento),
        url_producto:      r.url_producto,
        presentacion:      r.presentacion,
        promocion:         r.promocion,
        envio:             null,
        tienda_oficial:    null,
        full:              null,
        oferta_relampago:  null,
        cuotas_sin_interes: null,
        cupon:             null,
        ranking:           Number(r.best_ranking),
        appearances_p1:    Number(r.appearances_p1),
        appearances_total: Number(r.appearances_total),
      })))
    }

    // ── inventory (Abbott products only) ─────────────────
    if (action === "inventory") {
      const limit      = Math.min(1000, parseInt(searchParams.get("limit") || "200", 10))
      const dateParam  = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const show       = searchParams.get("show") || "all"
      const lookback   = Math.min(30, parseInt(searchParams.get("lookback") || "7", 10))
      const fabricante = searchParams.get("fabricante") || ""
      const p: unknown[] = [dateParam]
      let wCond = `titulo IS NOT NULL AND precio_venta IS NOT NULL`
      // Fabricante filter: ABBOTT uses LIKE match; others use unified CASE expression
      if (fabricante === "ABBOTT") {
        wCond += ` AND ${ABBOTT_LIKE}`
      } else if (fabricante) {
        p.push(fabricante)
        wCond += ` AND (${FABRICANTE_UNIFIED}) = $${p.length}`
      }
      if (channel)    { p.push(channel);  wCond += ` AND retail = $${p.length}` }
      if (category)   { p.push(category); wCond += ` AND categoria = $${p.length}` }
      if (country)    { p.push(country);  wCond += ` AND pais = $${p.length}` }
      wCond += marcaFilter(p).replace(' AND ', ' AND ')  // add segmento/mercado filter

      const todaySub = `
        SELECT id, marca, retail,
          MAX(titulo) AS titulo, MAX(fabricante) AS fabricante,
          MAX(categoria) AS categoria,
          MAX(ean) AS ean,
          ROUND(MAX(precio_venta::numeric), 0) AS precio_venta
        FROM eci.sos
        WHERE DATE(fecha) = $1::date AND ${wCond}
        GROUP BY id, marca, retail
      `
      const lbSub = `
        SELECT id, marca, retail,
          MAX(titulo) AS titulo, MAX(fabricante) AS fabricante,
          MAX(categoria) AS categoria,
          MAX(ean) AS ean,
          MAX(DATE(fecha))::text AS last_seen,
          COUNT(DISTINCT DATE(fecha))::int AS days_seen
        FROM eci.sos
        WHERE DATE(fecha) >= ($1::date - INTERVAL '${lookback} days')
          AND DATE(fecha) < $1::date
          AND ${wCond}
        GROUP BY id, marca, retail
      `
      const inStockSQL = `
        SELECT t.id, t.titulo AS producto, t.marca, t.categoria AS subcategoria,
          t.retail AS plataforma, t.marca AS norm_seller,
          t.precio_venta, lb.last_seen,
          COALESCE(lb.days_seen, 0) AS days_seen,
          'in_stock'::text AS stock_status,
          (${ABBOTT_LIKE.replace('fabricante', 't.fabricante')}) AS is_newsan,
          COALESCE(t.ean, lb.ean) AS ean
        FROM (${todaySub}) t
        LEFT JOIN (${lbSub}) lb ON lb.id = t.id AND lb.marca = t.marca AND lb.retail = t.retail
      `
      const breakSQL = `
        SELECT lb.id, lb.titulo AS producto, lb.marca, lb.categoria AS subcategoria,
          lb.retail AS plataforma, lb.marca AS norm_seller,
          NULL::numeric AS precio_venta, lb.last_seen, lb.days_seen,
          'break'::text AS stock_status,
          (${ABBOTT_LIKE.replace('fabricante', 'lb.fabricante')}) AS is_newsan,
          lb.ean
        FROM (${lbSub}) lb
        LEFT JOIN (${todaySub}) tod ON tod.id = lb.id AND tod.marca = lb.marca AND tod.retail = lb.retail
        WHERE tod.id IS NULL
      `
      const unionSQL = show === "in_stock" ? inStockSQL
                     : show === "break"    ? breakSQL
                     : `${inStockSQL} UNION ALL ${breakSQL}`
      const sql = `
        WITH combined AS (${unionSQL})
        SELECT c.*,
          COALESCE(c.ean, pm.ean) AS ean_resolved,
          pm.local_sku, pm.asin, pm.meli_id, pm.sap_sku
        FROM combined c
        LEFT JOIN eci.products_master pm ON pm.ean = COALESCE(c.ean, c.id::text)
        ORDER BY
          CASE c.stock_status WHEN 'break' THEN 0 ELSE 1 END,
          c.is_newsan DESC,
          c.last_seen DESC NULLS LAST,
          c.subcategoria, c.marca, c.producto
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; producto: string; marca: string; subcategoria: string; plataforma: string
        norm_seller: string; precio_venta: number | null; last_seen: string | null
        days_seen: number; stock_status: string; is_newsan: boolean
        ean_resolved: string | null; local_sku: string | null; asin: string | null
        meli_id: string | null; sap_sku: string | null
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        id:           r.id,
        producto:     r.producto,
        marca:        r.marca,
        subcategoria: r.subcategoria,
        plataforma:   r.plataforma,
        seller:       r.norm_seller,
        precio_venta: r.precio_venta != null ? Number(r.precio_venta) : null,
        last_seen:    r.last_seen != null ? String(r.last_seen).split("T")[0] : null,
        days_seen:    Number(r.days_seen),
        stock_status: r.stock_status,
        is_newsan:    Boolean(r.is_newsan),
        ean:          r.ean_resolved,
        sku:          r.local_sku || r.sap_sku,
        meli_id:      r.meli_id,
        asin:         r.asin,
      })))
    }

    // ── assortment ────────────────────────────────────────
    if (action === "assortment") {
      const limit    = Math.min(1000, parseInt(searchParams.get("limit") || "500", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const show     = searchParams.get("show") || "all"
      const p: unknown[] = [dateParam]
      let w = `DATE(fecha) = $1::date AND titulo IS NOT NULL AND precio_venta IS NOT NULL`
      if (channel)  { p.push(channel);  w += ` AND retail = $${p.length}` }
      if (category) { p.push(category); w += ` AND categoria = $${p.length}` }
      if (country)  { p.push(country);  w += ` AND pais = $${p.length}` }
      w += marcaFilter(p)
      const showFilter = show === "newsan" ? `ps.abbott_present = TRUE`
                       : show === "gaps"   ? `ps.abbott_present = FALSE`
                       : `TRUE`
      const sql = `
        WITH data AS (
          SELECT DISTINCT ON (id, marca)
            id, titulo, marca, categoria, retail, fabricante,
            ROUND(precio_venta::numeric, 0) AS precio_venta
          FROM eci.sos
          WHERE ${w}
          ORDER BY id, marca, ranking::numeric ASC NULLS LAST
        ),
        product_summary AS (
          SELECT
            id,
            MAX(titulo) AS producto,
            MAX(marca) AS marca,
            MAX(categoria) AS categoria,
            MAX(retail) AS retail,
            COUNT(DISTINCT marca) AS total_sellers,
            MAX(CASE WHEN ${ABBOTT_LIKE} THEN precio_venta END) AS newsan_price,
            MIN(CASE WHEN NOT (${ABBOTT_LIKE}) THEN precio_venta END) AS comp_min_price,
            MAX(CASE WHEN NOT (${ABBOTT_LIKE}) THEN precio_venta END) AS comp_max_price,
            BOOL_OR(${ABBOTT_LIKE}) AS abbott_present,
            MIN(precio_venta) AS min_price
          FROM data
          GROUP BY id
        ),
        with_tier AS (
          SELECT *,
            NTILE(3) OVER (PARTITION BY categoria ORDER BY min_price) AS tier_num
          FROM product_summary
        )
        SELECT
          id, producto, marca, categoria AS subcategoria, retail AS plataforma,
          total_sellers, newsan_price, comp_min_price, comp_max_price, abbott_present AS newsan_present,
          CASE tier_num WHEN 1 THEN 'Entry' WHEN 2 THEN 'Mid' ELSE 'Premium' END AS tier
        FROM with_tier ps
        WHERE ${showFilter}
        ORDER BY categoria, marca, producto
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; producto: string; marca: string; subcategoria: string; plataforma: string
        total_sellers: number; newsan_price: number | null; comp_min_price: number | null
        comp_max_price: number | null; newsan_present: boolean; tier: string
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        id:             r.id,
        producto:       r.producto,
        marca:          r.marca,
        subcategoria:   r.subcategoria,
        plataforma:     r.plataforma,
        total_sellers:  Number(r.total_sellers),
        newsan_price:   r.newsan_price    != null ? Number(r.newsan_price)    : null,
        comp_min_price: r.comp_min_price  != null ? Number(r.comp_min_price)  : null,
        comp_max_price: r.comp_max_price  != null ? Number(r.comp_max_price)  : null,
        newsan_present: Boolean(r.newsan_present),
        tier:           r.tier,
      })))
    }

    // ── buybox ────────────────────────────────────────────
    if (action === "buybox") {
      const limit = Math.min(500, parseInt(searchParams.get("limit") || "100", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const show = searchParams.get("show") || "all"
      const p: unknown[] = [dateParam]
      let w = `DATE(fecha) = $1::date AND ranking IS NOT NULL AND id IS NOT NULL AND precio_venta IS NOT NULL`
      if (channel)  { p.push(channel);  w += ` AND retail = $${p.length}` }
      if (category) { p.push(category); w += ` AND categoria = $${p.length}` }
      if (country)  { p.push(country);  w += ` AND pais = $${p.length}` }
      const showFilter = show === "wins"  ? `(${ABBOTT_LIKE.replace('fabricante', 'w.winner_fabricante')})`
                       : show === "loses" ? `s.abbott_price IS NOT NULL AND NOT (${ABBOTT_LIKE.replace('fabricante', 'w.winner_fabricante')})`
                       : show === "gaps"  ? `s.abbott_price IS NULL`
                       : `TRUE`
      const sql = `
        WITH normalized AS (
          SELECT
            id, titulo, marca, categoria, retail,
            precio_venta::numeric AS precio_venta,
            precio_neto::numeric AS precio_neto,
            descuento::numeric AS descuento,
            ranking::numeric AS ranking,
            fabricante, url_producto
          FROM eci.sos WHERE ${w}
        ),
        winner AS (
          SELECT DISTINCT ON (id)
            id,
            MAX(titulo) OVER (PARTITION BY id) AS titulo,
            MAX(marca) OVER (PARTITION BY id) AS marca,
            MAX(categoria) OVER (PARTITION BY id) AS categoria,
            MAX(retail) OVER (PARTITION BY id) AS retail,
            marca AS winner_seller,
            fabricante AS winner_fabricante,
            ROUND(precio_venta, 0) AS winner_price,
            ROUND(precio_neto, 0) AS winner_precio_original,
            ROUND(descuento, 1) AS winner_descuento,
            url_producto AS winner_url,
            ranking AS winner_ranking
          FROM normalized
          ORDER BY id, ranking ASC NULLS LAST, precio_venta ASC
        ),
        stats AS (
          SELECT
            id,
            COUNT(DISTINCT marca) AS total_sellers,
            MAX(CASE WHEN ${ABBOTT_LIKE} THEN ROUND(precio_venta, 0) END) AS abbott_price,
            MIN(CASE WHEN ${ABBOTT_LIKE} THEN ranking END) AS abbott_ranking
          FROM normalized
          GROUP BY id
        )
        SELECT
          w.id, w.titulo AS producto, w.marca, w.categoria AS subcategoria, w.retail AS plataforma,
          w.winner_seller, w.winner_fabricante, w.winner_price, w.winner_precio_original,
          w.winner_descuento, w.winner_url, w.winner_ranking,
          s.total_sellers, s.abbott_price AS newsan_price, s.abbott_ranking AS newsan_ranking,
          (s.abbott_price IS NOT NULL) AS newsan_present,
          (${ABBOTT_LIKE.replace('fabricante', 'w.winner_fabricante')}) AS newsan_wins
        FROM winner w
        JOIN stats s ON s.id = w.id
        WHERE ${showFilter}
        ORDER BY w.winner_ranking ASC NULLS LAST
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; producto: string; marca: string; subcategoria: string; plataforma: string
        winner_seller: string; winner_fabricante: string; winner_price: number
        winner_precio_original: number; winner_descuento: number; winner_url: string
        winner_ranking: number; total_sellers: number
        newsan_price: number | null; newsan_ranking: number | null
        newsan_present: boolean; newsan_wins: boolean
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        id:                     r.id,
        producto:               r.producto,
        marca:                  r.marca,
        subcategoria:           r.subcategoria,
        plataforma:             r.plataforma,
        winner_seller:          r.winner_seller,
        winner_price:           Number(r.winner_price),
        winner_precio_original: r.winner_precio_original != null ? Number(r.winner_precio_original) : null,
        winner_descuento:       r.winner_descuento != null ? Number(r.winner_descuento) : null,
        winner_envio:           null,
        winner_url:             r.winner_url,
        winner_ranking:         Number(r.winner_ranking),
        total_sellers:          Number(r.total_sellers),
        newsan_price:           r.newsan_price   != null ? Number(r.newsan_price)   : null,
        newsan_ranking:         r.newsan_ranking != null ? Number(r.newsan_ranking) : null,
        newsan_envio:           null,
        newsan_cuotas:          null,
        newsan_present:         Boolean(r.newsan_present),
        newsan_wins:            Boolean(r.newsan_wins),
      })))
    }

    // ── buybox_lost ───────────────────────────────────────
    if (action === "buybox_lost") {
      const limit = Math.min(500, parseInt(searchParams.get("limit") || "200", 10))
      const p: unknown[] = [limit]
      let channelSql  = ""
      let categorySql = ""
      let countrySql  = ""
      if (channel)  { p.push(channel);  channelSql  = `AND s.retail = $${p.length}` }
      if (category) { p.push(category); categorySql = `AND s.categoria = $${p.length}` }
      if (country)  { p.push(country);  countrySql  = `AND s.pais = $${p.length}` }
      let mfBuybox = ""
      if (segmento || mercado) {
        let sub = `AND s.fabricante IN (SELECT DISTINCT mf2.fabricante FROM eci.marca_fabricante mf2 WHERE 1=1`
        if (segmento) { p.push(segmento); sub += ` AND mf2.segmento = $${p.length}` }
        if (mercado)  { p.push(mercado);  sub += ` AND mf2.mercado = $${p.length}` }
        sub += ")"
        mfBuybox = sub
      }

      const sql = `
        WITH
        latest_date AS (
          SELECT MAX(DATE(s.fecha)) AS max_date
          FROM eci.sos s
          WHERE s.id IS NOT NULL AND s.precio_venta IS NOT NULL AND s.ranking IS NOT NULL
            ${channelSql} ${categorySql} ${countrySql} ${mfBuybox}
        ),
        abbott_present_7d AS (
          SELECT DISTINCT s.id
          FROM eci.sos s, latest_date
          WHERE s.fecha >= latest_date.max_date - INTERVAL '6 days'
            AND s.fecha < latest_date.max_date + INTERVAL '1 day'
            AND s.id IS NOT NULL AND s.precio_venta IS NOT NULL AND s.ranking IS NOT NULL
            AND ${ABBOTT_LIKE.replace('fabricante', 's.fabricante')}
            ${channelSql} ${categorySql} ${countrySql} ${mfBuybox}
        ),
        raw_latest AS (
          SELECT
            s.id, s.titulo, s.marca, s.categoria, s.retail, s.fabricante, s.ean,
            s.precio_venta::numeric AS precio_venta,
            s.ranking::numeric AS ranking,
            s.url_producto,
            ROW_NUMBER() OVER (
              PARTITION BY s.id
              ORDER BY s.ranking::numeric ASC NULLS LAST, s.precio_venta::numeric ASC
            ) AS rn
          FROM eci.sos s, latest_date
          WHERE DATE(s.fecha) = latest_date.max_date
            AND s.id IS NOT NULL AND s.precio_venta IS NOT NULL AND s.ranking IS NOT NULL
            ${channelSql} ${categorySql} ${countrySql} ${mfBuybox}
        ),
        latest_winners AS (
          SELECT id, titulo AS producto, marca, categoria AS subcategoria,
                 retail AS plataforma, marca AS winner_seller,
                 precio_venta AS winner_price, url_producto AS winner_url, ean
          FROM raw_latest WHERE rn = 1
        ),
        abbott_latest AS (
          SELECT id, ROUND(MAX(precio_venta), 0) AS newsan_price
          FROM raw_latest
          WHERE ${ABBOTT_LIKE.replace('fabricante', 'fabricante')}
          GROUP BY id
        )
        SELECT
          lw.id, lw.producto, lw.marca, lw.subcategoria, lw.plataforma,
          lw.winner_seller,
          ROUND(lw.winner_price, 0) AS winner_price,
          lw.winner_url,
          al.newsan_price,
          FALSE AS newsan_wins,
          (SELECT max_date::text FROM latest_date) AS latest_date,
          COALESCE(lw.ean, pm.ean) AS ean,
          pm.local_sku, pm.asin, pm.meli_id, pm.sap_sku
        FROM abbott_present_7d ap
        JOIN latest_winners lw ON lw.id = ap.id
        LEFT JOIN abbott_latest al ON al.id = ap.id
        LEFT JOIN eci.products_master pm ON pm.ean = COALESCE(lw.ean, lw.id::text)
        ORDER BY ROUND(lw.winner_price, 0) DESC NULLS LAST
        LIMIT $1
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; producto: string; marca: string; subcategoria: string; plataforma: string
        winner_seller: string; winner_price: number; winner_url: string | null
        newsan_price: number | null; newsan_wins: boolean; latest_date: string
        ean: string | null; local_sku: string | null; asin: string | null
        meli_id: string | null; sap_sku: string | null
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        id:            r.id,
        producto:      r.producto,
        marca:         r.marca,
        subcategoria:  r.subcategoria,
        plataforma:    r.plataforma,
        winner_seller: r.winner_seller,
        winner_price:  Number(r.winner_price),
        winner_envio:  null,
        winner_url:    r.winner_url,
        newsan_price:  r.newsan_price != null ? Number(r.newsan_price) : null,
        newsan_wins:   Boolean(r.newsan_wins),
        latest_date:   r.latest_date,
        ean:           r.ean,
        sku:           r.local_sku || r.sap_sku,
        meli_id:       r.meli_id,
        asin:          r.asin,
      })))
    }

    // ── price index ───────────────────────────────────────
    if (action === "price_index") {
      const limit    = Math.min(500, parseInt(searchParams.get("limit") || "200", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const show     = searchParams.get("show") || "newsan"
      const p: unknown[] = [dateParam]
      let w = `DATE(fecha) = $1::date AND precio_venta IS NOT NULL AND id IS NOT NULL`
      if (channel)  { p.push(channel);  w += ` AND retail = $${p.length}` }
      if (category) { p.push(category); w += ` AND categoria = $${p.length}` }
      if (country)  { p.push(country);  w += ` AND pais = $${p.length}` }
      w += marcaFilter(p)
      const showFilter = show === "newsan" ? "AND abbott_price IS NOT NULL"
                       : show === "gaps"   ? "AND abbott_price IS NULL"
                       : ""
      const sql = `
        WITH normalized AS (
          SELECT id, titulo, marca, categoria, retail, fabricante,
            precio_venta::numeric AS precio_venta
          FROM eci.sos WHERE ${w}
        ),
        base AS (
          SELECT
            id,
            MAX(titulo) AS titulo,
            MAX(marca) AS marca,
            MAX(categoria) AS categoria,
            MAX(retail) AS retail,
            ROUND(AVG(precio_venta), 0) AS avg_price,
            ROUND(MIN(precio_venta), 0) AS min_price,
            ROUND(AVG(CASE WHEN ${ABBOTT_LIKE} THEN precio_venta END), 0) AS abbott_price,
            ROUND(AVG(CASE WHEN NOT (${ABBOTT_LIKE}) THEN precio_venta END), 0) AS comp_avg_price,
            ROUND(MIN(CASE WHEN NOT (${ABBOTT_LIKE}) THEN precio_venta END), 0) AS comp_min_price,
            COUNT(DISTINCT CASE WHEN NOT (${ABBOTT_LIKE}) THEN marca END) AS competitor_count
          FROM normalized
          GROUP BY id
        )
        SELECT *,
          ROUND((abbott_price / NULLIF(comp_avg_price, 0)) * 100, 1) AS price_index
        FROM base
        WHERE avg_price IS NOT NULL ${showFilter}
        ORDER BY
          CASE WHEN abbott_price IS NOT NULL THEN 0 ELSE 1 END,
          (abbott_price / NULLIF(comp_avg_price, 0)) * 100 DESC NULLS LAST
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; titulo: string; marca: string; categoria: string; retail: string
        avg_price: number; min_price: number
        abbott_price: number | null; comp_avg_price: number | null; comp_min_price: number | null
        competitor_count: number; price_index: number | null
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        id:               r.id,
        producto:         r.titulo,
        marca:            r.marca,
        subcategoria:     r.categoria,
        plataforma:       r.retail,
        avg_price:        Number(r.avg_price),
        min_price:        Number(r.min_price),
        newsan_price:     r.abbott_price    != null ? Number(r.abbott_price)    : null,
        comp_avg_price:   r.comp_avg_price  != null ? Number(r.comp_avg_price)  : null,
        comp_min_price:   r.comp_min_price  != null ? Number(r.comp_min_price)  : null,
        competitor_count: Number(r.competitor_count),
        newsan_cuotas:    null,
        price_index:      r.price_index     != null ? Number(r.price_index)     : null,
      })))
    }

    // ── pricing live ──────────────────────────────────────
    // ── debug: inspect pricing DB state ─────────────────
    if (action === "debug_pricing") {
      const dateParam = searchParams.get("date") || new Date().toISOString().split("T")[0]
      const info: Record<string, unknown> = { date_queried: dateParam }

      // Does the MV exist?
      const mvExistsRow = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema='eci' AND table_name='mv_sos_product_latest'
         ) AS exists`
      )
      info.mv_exists = mvExistsRow[0]?.exists
      if (info.mv_exists) {
        const mvStats = await prisma.$queryRawUnsafe<{ total: number; date_match: number; with_price: number }[]>(
          `SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE fecha = $1::date)::int AS date_match,
             COUNT(*) FILTER (WHERE fecha = $1::date
               AND (COALESCE(precio_venta,0)>0 OR COALESCE(precio_neto,0)>0))::int AS with_price
           FROM eci.mv_sos_product_latest`,
          dateParam
        )
        info.mv_stats = mvStats[0]
        const mvDates = await prisma.$queryRawUnsafe<{ min_f: string; max_f: string }[]>(
          `SELECT MIN(fecha)::text AS min_f, MAX(fecha)::text AS max_f FROM eci.mv_sos_product_latest`
        )
        info.mv_date_range = mvDates[0]
      }

      // Real eci.sos columns and stats
      const sosCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='eci' AND table_name='sos' ORDER BY ordinal_position`
      )
      info.sos_columns = sosCols.map(c => c.column_name)
      const sosStats = await prisma.$queryRawUnsafe<{ total: number; date_match: number; with_price: number }[]>(
        `SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE fecha::date = $1::date)::int AS date_match,
           COUNT(*) FILTER (WHERE fecha::date = $1::date
             AND COALESCE(precio_venta::numeric,0) > 0)::int AS with_price
         FROM eci.sos`,
        dateParam
      )
      info.sos_stats = sosStats[0]
      const sosDates = await prisma.$queryRawUnsafe<{ min_f: string; max_f: string }[]>(
        `SELECT MIN(fecha)::text AS min_f, MAX(fecha)::text AS max_f FROM eci.sos`
      )
      info.sos_date_range = sosDates[0]
      const sample = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM eci.sos WHERE fecha::date = $1::date LIMIT 1`, dateParam
      )
      info.sos_sample = sample[0] ?? null
      return NextResponse.json(info)
    }

    if (action === "pricing") {
      const limit = Math.min(500, parseInt(searchParams.get("limit") || "100", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]

      // Shared row mapper — handles both MV and direct eci.sos shapes
      function mapRow(r: Record<string, unknown>) {
        const pv = Number(r.precio_venta ?? 0)
        const pn = Number(r.precio_neto ?? r.precio ?? 0)
        return {
          id:                       r.id,
          producto:                 r.producto ?? r.titulo,
          marca:                    r.marca,
          country:                  r.pais,
          seller:                   r.seller ?? r.retail,
          plataforma:               r.plataforma ?? r.retail,
          subcategoria:             r.subcategoria ?? r.categoria,
          fabricante:               r.fabricante,
          precio_venta:             pv > 0 ? pv : pn,
          precio:                   Math.max(pv, pn) || null,
          descuento:                Number(r.descuento ?? 0),
          cuotas_sin_interes:       null,
          tiene_cuotas_sin_interes: null,
          detalle_cuotas:           null,
          oferta_relampago:         null,
          cupon:                    null,
          full_ml:                  null,
          envio:                    null,
          tienda_oficial:           null,
          url_producto:             r.url_producto,
          promocion:                r.promocion,
          presentacion:             r.presentacion,
        }
      }

      // ── 1. Try materialized view first ───────────────────
      try {
        const p: unknown[] = [dateParam]
        let w = `fecha = $1::date`
        if (channel)  { p.push(channel);  w += ` AND retail = $${p.length}` }
        if (category) { p.push(category); w += ` AND categoria = $${p.length}` }
        if (country)  { p.push(country);  w += ` AND pais = $${p.length}` }
        const mfCond = marcaFilter(p)
        let sellerCond = ""
        if (seller) { p.push(seller); sellerCond = ` AND fabricante = $${p.length}` }
        const sqlMV = `
          SELECT
            producto_id AS id, titulo AS producto, marca, pais,
            retail AS seller, retail AS plataforma, categoria AS subcategoria, fabricante,
            COALESCE(precio_venta,0)::numeric AS precio_venta,
            COALESCE(precio_neto, 0)::numeric AS precio_neto,
            COALESCE(descuento,   0)::numeric AS descuento,
            promocion, presentacion, url_producto
          FROM eci.mv_sos_product_latest
          WHERE ${w} AND producto_id IS NOT NULL ${sellerCond}${mfCond}
          ORDER BY GREATEST(COALESCE(precio_venta,0), COALESCE(precio_neto,0)) DESC
          LIMIT ${limit}
        `
        const rowsMV = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sqlMV, ...p)
        if (rowsMV.length > 0) return NextResponse.json(rowsMV.map(mapRow))
        // MV returned 0 rows — fall through to direct query
      } catch {
        // MV doesn't exist or errored — fall through to direct query
      }

      // ── 2. Fallback: query eci.sos directly ──────────────
      const p2: unknown[] = [dateParam]
      let w2 = `fecha::date = $1::date AND id IS NOT NULL`
      if (channel)  { p2.push(channel);  w2 += ` AND retail = $${p2.length}` }
      if (category) { p2.push(category); w2 += ` AND categoria = $${p2.length}` }
      if (country)  { p2.push(country);  w2 += ` AND pais = $${p2.length}` }
      let sellerCond2 = ""
      if (seller) {
        p2.push(seller)
        sellerCond2 = ` AND (CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante,'DESCONOCIDO') END) = $${p2.length}`
      }
      const mfCond2 = marcaFilter(p2)
      const sqlDirect = `
        SELECT
          id,
          MAX(titulo) AS producto,
          MAX(marca) AS marca,
          MAX(pais) AS pais,
          retail AS seller,
          retail AS plataforma,
          MAX(categoria) AS subcategoria,
          CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT'
               ELSE COALESCE(fabricante,'DESCONOCIDO') END AS fabricante,
          ROUND(AVG(COALESCE(precio_venta::numeric,0)), 0) AS precio_venta,
          ROUND(AVG(COALESCE(precio_neto::numeric, 0)), 0) AS precio_neto,
          ROUND(AVG(COALESCE(descuento::numeric,   0)), 1) AS descuento,
          MAX(url_producto) AS url_producto,
          MAX(presentacion) AS presentacion,
          MAX(promocion) AS promocion
        FROM eci.sos
        WHERE ${w2} ${sellerCond2}${mfCond2}
        GROUP BY id, retail,
          CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT'
               ELSE COALESCE(fabricante,'DESCONOCIDO') END
        ORDER BY GREATEST(
          AVG(COALESCE(precio_venta::numeric,0)),
          AVG(COALESCE(precio_neto::numeric, 0))
        ) DESC
        LIMIT ${limit}
      `
      const rowsDirect = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sqlDirect, ...p2)
      return NextResponse.json(rowsDirect.map(mapRow))
    }

    // ── marca_fabricante ──────────────────────────────────
    if (action === "marca_fabricante") {
      const p: unknown[] = []
      let w = "1=1"
      if (segmento) { p.push(segmento); w += ` AND mf.segmento = $${p.length}` }
      if (mercado)  { p.push(mercado);  w += ` AND mf.mercado = $${p.length}` }
      const sql = `
        SELECT mf.marca, mf.fabricante, mf.segmento, mf.mercado
        FROM eci.marca_fabricante mf
        WHERE ${w}
        ORDER BY mf.marca
        LIMIT 500
      `
      const rows = await prisma.$queryRawUnsafe<{
        marca: string; fabricante: string
        segmento: string | null; mercado: string | null
      }[]>(sql, ...p)
      return NextResponse.json(rows)
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error"
    console.error("API Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
