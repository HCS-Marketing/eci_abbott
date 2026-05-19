import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ── MOCK FALLBACK (used when DB tables are empty) ──────────

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const MOCK_SELLERS    = ["Seller 1", "Seller 2", "Seller 3", "Seller 4", "Seller 5", "Seller 6"]
const MOCK_CATEGORIES = ["Categoría 1", "Categoría 2", "Categoría 3"]
const MOCK_CHANNELS   = ["Canal 1", "Canal 2", "Canal 3"]
const MOCK_COLORS: Record<string, string> = {
  "Seller 1": "#A427FF",
  "Seller 2": "#3b82f6",
  "Seller 3": "#ef4444",
  "Seller 4": "#f59e0b",
  "Seller 5": "#06b6d4",
  "Seller 6": "#84cc16",
}

function mockSellerEntry(seller: string, idx: number) {
  const rng = seededRandom(seller.length * 73 + idx * 41)
  const p1    = Math.round((8 + rng() * 22) * 10) / 10
  const total = Math.round((p1 + rng() * 8) * 10) / 10
  return {
    seller,
    sos_p1:           p1,
    sos_total:        total,
    sos_p1_change:    Math.round((rng() - 0.42) * 8 * 10) / 10,
    sos_total_change: Math.round((rng() - 0.42) * 6 * 10) / 10,
    products_p1:      Math.floor(2 + rng() * 8),
    products_total:   Math.floor(4 + rng() * 15),
    color:            MOCK_COLORS[seller] || "#888",
    rank:             0,
  }
}

// ── Seller normalization ──────────────────────────────────
// Add aliases here: { "raw DB name": "canonical name" }
const SELLER_ALIASES: Record<string, string> = {
  "Tienda Newsan": "Newsan",
}

// SQL CASE expression to normalize seller column
const NORM_SELLER = Object.entries(SELLER_ALIASES)
  .map(([alias, canonical]) => `WHEN seller = '${alias}' THEN '${canonical}'`)
  .reduce((acc, c) => acc + " " + c, "CASE") + " ELSE seller END"

// Returns all raw DB names (canonical + aliases) for a canonical seller name
function expandSeller(canonical: string): string[] {
  const aliases = Object.entries(SELLER_ALIASES)
    .filter(([, c]) => c === canonical).map(([a]) => a)
  return [canonical, ...aliases]
}

// Builds SQL `seller IN ($N, $N+1, ...)` expanding aliases, appends to params
function sellerInSql(canonical: string, params: unknown[]): string {
  const names = expandSeller(canonical)
  const placeholders = names.map((_, i) => `$${params.length + i + 1}`).join(", ")
  names.forEach(n => params.push(n))
  return `seller IN (${placeholders})`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action   = searchParams.get("action") || "sellers"
  const channel  = searchParams.get("channel") || ""
  const category = searchParams.get("category") || ""
  const seller   = searchParams.get("seller") || ""
  const sellersParam = searchParams.get("sellers")?.split(",").filter(Boolean) || []

  try {
    // ── rango de fechas disponible ────────────────────────
    if (action === "dates") {
      // Si viene channel, filtrar por plataforma para devolver el max de ese canal
      if (channel) {
        const rows = await prisma.$queryRawUnsafe<{ min_d: Date; max_d: Date }[]>(
          `SELECT MIN(DATE(fecha))::date AS min_d, MAX(DATE(fecha))::date AS max_d FROM eci.sos WHERE plataforma = $1`,
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
        SELECT MIN(DATE(fecha))::date AS min_d, MAX(DATE(fecha))::date AS max_d FROM eci.sos
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

    // helper: build common WHERE clause (fecha + optional channel/category)
    function buildWhere(
      params: unknown[],
      opts: { channel?: boolean; category?: boolean } = { channel: true, category: true }
    ) {
      params.push(startD, endD)
      let w = `fecha >= $${params.length - 1} AND fecha <= $${params.length}`
      if (opts.channel !== false && channel) {
        params.push(channel)
        w += ` AND plataforma = $${params.length}`
      }
      if (opts.category !== false && category) {
        params.push(category)
        w += ` AND subcategoria = $${params.length}`
      }
      return w
    }

    // ── sellers list ──────────────────────────────────────
    if (action === "sellers_list") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const sql = `SELECT DISTINCT ${NORM_SELLER} AS n FROM eci.sos WHERE ${w} AND seller IS NOT NULL ORDER BY 1`
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      if (rows.length === 0) return NextResponse.json(MOCK_SELLERS)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── categories list (filtrada por canal + fechas) ─────
    if (action === "categories") {
      const startDate = searchParams.get("startDate") || ""
      const endDate   = searchParams.get("endDate")   || ""
      const startD = startDate ? new Date(startDate + "T00:00:00Z") : new Date("2000-01-01T00:00:00Z")
      const endD   = endDate   ? new Date(endDate   + "T23:59:59Z") : new Date("2099-12-31T23:59:59Z")

      const params: unknown[] = [startD, endD]
      let sql = `SELECT DISTINCT subcategoria AS n FROM eci.sos
                 WHERE fecha >= $1 AND fecha <= $2 AND subcategoria IS NOT NULL`
      if (channel) { sql += ` AND plataforma = $${params.length + 1}`; params.push(channel) }
      sql += " ORDER BY 1"

      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...params)
      if (rows.length === 0) return NextResponse.json(MOCK_CATEGORIES)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── channels list (filtrada por categoría + fechas) ───
    if (action === "channels") {
      const startDate = searchParams.get("startDate") || ""
      const endDate   = searchParams.get("endDate")   || ""
      const startD = startDate ? new Date(startDate + "T00:00:00Z") : new Date("2000-01-01T00:00:00Z")
      const endD   = endDate   ? new Date(endDate   + "T23:59:59Z") : new Date("2099-12-31T23:59:59Z")

      const params: unknown[] = [startD, endD]
      let sql = `SELECT DISTINCT plataforma AS n FROM eci.sos
                 WHERE fecha >= $1 AND fecha <= $2 AND plataforma IS NOT NULL`
      if (category) { sql += ` AND subcategoria = $${params.length + 1}`; params.push(category) }
      sql += " ORDER BY 1"

      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...params)
      if (rows.length === 0) return NextResponse.json(MOCK_CHANNELS)
      return NextResponse.json(rows.map(r => r.n))
    }

    const PALETTE = ["#A427FF","#3b82f6","#ef4444","#f59e0b","#06b6d4","#84cc16","#ec4899","#14b8a6","#f97316","#8b5cf6"]

    // ── sellers SOS overview ──────────────────────────────
    if (action === "sellers") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const sql = `
        WITH base AS (
          SELECT ${NORM_SELLER} AS seller, pagina FROM eci.sos WHERE ${w} AND seller IS NOT NULL
        ),
        total_p1  AS (SELECT COUNT(*) AS t FROM base WHERE pagina = 1),
        total_all AS (SELECT COUNT(*) AS t FROM base),
        per_seller AS (
          SELECT seller,
            COUNT(*) FILTER (WHERE pagina = 1) AS products_p1,
            COUNT(*) AS products_total
          FROM base GROUP BY seller
        )
        SELECT s.seller,
          s.products_p1::int, s.products_total::int,
          ROUND(s.products_p1 * 100.0 / NULLIF(tp.t, 0), 2) AS sos_p1,
          ROUND(s.products_total * 100.0 / NULLIF(ta.t, 0), 2) AS sos_total
        FROM per_seller s, total_p1 tp, total_all ta
        ORDER BY sos_p1 DESC
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
        color:            PALETTE[i % PALETTE.length],
        rank:             i + 1,
      })))
    }

    // ── brand-level breakdown ─────────────────────────────
    if (action === "brands") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p)
      const sellerCond = sellerInSql(seller, p)
      const sql = `
        WITH base AS (
          SELECT marca, pagina FROM eci.sos
          WHERE ${w} AND ${sellerCond} AND marca IS NOT NULL
        ),
        total_p1  AS (SELECT COUNT(*) AS t FROM base WHERE pagina = 1),
        total_all AS (SELECT COUNT(*) AS t FROM base),
        per_brand AS (
          SELECT marca,
            COUNT(*) FILTER (WHERE pagina = 1) AS products_p1,
            COUNT(*) AS products_total
          FROM base GROUP BY marca
        )
        SELECT b.marca AS brand,
          b.products_p1::int, b.products_total::int,
          ROUND(b.products_p1 * 100.0 / NULLIF(tp.t, 0), 2) AS sos_p1,
          ROUND(b.products_total * 100.0 / NULLIF(ta.t, 0), 2) AS sos_total
        FROM per_brand b, total_p1 tp, total_all ta
        ORDER BY sos_p1 DESC
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

    // ── título breakdown ──────────────────────────────────
    if (action === "titulos") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p)
      const sellerCond = sellerInSql(seller, p)
      const sql = `
        WITH base AS (
          SELECT id, producto, pagina, ranking FROM eci.sos
          WHERE ${w} AND ${sellerCond} AND producto IS NOT NULL
        ),
        total_p1  AS (SELECT COUNT(*) AS t FROM base WHERE pagina = 1),
        total_all AS (SELECT COUNT(*) AS t FROM base),
        per_titulo AS (
          SELECT id, MAX(producto) AS titulo,
            COUNT(*) FILTER (WHERE pagina = 1) AS products_p1,
            COUNT(*) AS products_total,
            MIN(ranking) AS best_ranking
          FROM base GROUP BY id
        )
        SELECT t.id AS titulo_id, t.titulo,
          t.products_p1::int, t.products_total::int,
          t.best_ranking::int,
          ROUND(t.products_p1 * 100.0 / NULLIF(tp.t, 0), 2) AS sos_p1,
          ROUND(t.products_total * 100.0 / NULLIF(ta.t, 0), 2) AS sos_total
        FROM per_titulo t, total_p1 tp, total_all ta
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
        ranking_pos:      Number(r.best_ranking),
        products_p1:      Number(r.products_p1),
      })))
    }

    // ── trend diario por seller ───────────────────────────
    if (action === "trend") {
      const sellerList = sellersParam.length ? sellersParam : []
      if (sellerList.length === 0) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p)
      // Expand each canonical seller name to include its aliases
      const expandedSellers = sellerList.flatMap(s => expandSeller(s))
      const sellerPlaceholders = expandedSellers.map((_, i) => `$${p.length + i + 1}`).join(", ")
      expandedSellers.forEach(s => p.push(s))
      const sql = `
        WITH base AS (
          SELECT DATE(fecha) AS day, ${NORM_SELLER} AS seller, pagina FROM eci.sos
          WHERE ${w} AND seller IS NOT NULL
        ),
        daily_total AS (
          SELECT day, COUNT(*) FILTER (WHERE pagina = 1) AS total_p1
          FROM base GROUP BY day
        ),
        seller_daily AS (
          SELECT day, seller, COUNT(*) FILTER (WHERE pagina = 1) AS products_p1
          FROM base WHERE seller IN (${sellerPlaceholders})
          GROUP BY day, seller
        )
        SELECT sd.day::text, sd.seller,
          ROUND(sd.products_p1 * 100.0 / NULLIF(dt.total_p1, 0), 2) AS sos_p1
        FROM seller_daily sd
        JOIN daily_total dt ON sd.day = dt.day
        ORDER BY sd.day, sd.seller
      `
      const rows = await prisma.$queryRawUnsafe<{ day: string; seller: string; sos_p1: number }[]>(sql, ...p)
      const dayMap = new Map<string, Record<string, unknown>>()
      rows.forEach(r => {
        if (!dayMap.has(r.day)) dayMap.set(r.day, { week: r.day })
        dayMap.get(r.day)![r.seller] = Number(r.sos_p1)
      })
      return NextResponse.json(Array.from(dayMap.values()))
    }

    // ── SOS by channel for a single seller ────────────────
    if (action === "by_channel") {
      if (!seller) return NextResponse.json([])
      // channel filter not applied here — the chart already breaks down by channel
      const p: unknown[] = []
      const w = buildWhere(p, { channel: false, category: true })
      const sellerCond = sellerInSql(seller, p)
      const sql = `
        WITH base AS (
          SELECT plataforma, pagina,
            CASE WHEN ${sellerCond} THEN 1 ELSE 0 END AS is_seller
          FROM eci.sos WHERE ${w} AND plataforma IS NOT NULL
        )
        SELECT plataforma AS channel,
          ROUND(
            SUM(CASE WHEN is_seller = 1 AND pagina = 1 THEN 1 ELSE 0 END) * 100.0
            / NULLIF(SUM(CASE WHEN pagina = 1 THEN 1 ELSE 0 END), 0), 2
          ) AS sos_p1,
          ROUND(
            SUM(CASE WHEN is_seller = 1 THEN 1 ELSE 0 END) * 100.0
            / NULLIF(COUNT(*), 0), 2
          ) AS sos_total
        FROM base
        GROUP BY plataforma
        HAVING SUM(CASE WHEN is_seller = 1 THEN 1 ELSE 0 END) > 0
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

    // ── ranking de productos por posición ────────────────
    if (action === "ranking") {
      const pageFilter = searchParams.get("page_filter") || "all" // "p1" | "all"
      const limit = Math.min(200, parseInt(searchParams.get("limit") || "50", 10))
      const p: unknown[] = []
      const w = buildWhere(p)
      const pageClause = pageFilter === "p1" ? "AND pagina = 1" : ""
      const sellerCond = seller ? ` AND (${sellerInSql(seller, p)})` : ""
      const sql = `
        SELECT
          id,
          MAX(producto) AS titulo,
          MAX(marca) AS marca,
          ${NORM_SELLER} AS seller,
          ROUND(AVG(ranking)) AS best_ranking,
          COUNT(*) FILTER (WHERE pagina = 1) AS appearances_p1,
          COUNT(*) AS appearances_total,
          MAX(pagina) AS max_page
        FROM eci.sos
        WHERE ${w} ${pageClause} AND id IS NOT NULL AND ranking IS NOT NULL ${sellerCond}
        GROUP BY id, ${NORM_SELLER}
        ORDER BY best_ranking DESC
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; titulo: string; marca: string; seller: string
        best_ranking: number; appearances_p1: number; appearances_total: number; max_page: number
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        id:               r.id,
        titulo:           r.titulo,
        marca:            r.marca,
        seller:           r.seller,
        ranking:          Number(r.best_ranking),
        appearances_p1:   Number(r.appearances_p1),
        appearances_total: Number(r.appearances_total),
      })))
    }

    // ── bestsellers ────────────────────────────────────────
    if (action === "bestsellers") {
      const pageFilter = searchParams.get("page_filter") || "p1"
      const limit = Math.min(100, parseInt(searchParams.get("limit") || "20", 10))
      // Fecha única (usa param "date", cae a endDate si no viene)
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const p: unknown[] = [dateParam]
      let w = `DATE(fecha) = $1::date`
      if (channel)  { p.push(channel);  w += ` AND plataforma = $${p.length}` }
      if (category) { p.push(category); w += ` AND subcategoria = $${p.length}` }
      const pageClause = pageFilter === "p1" ? "AND pagina = 1" : ""
      const sellerCond = seller ? ` AND (${sellerInSql(seller, p)})` : ""
      const sql = `
        SELECT
          id,
          MAX(producto)           AS titulo,
          MAX(marca)              AS marca,
          ${NORM_SELLER}          AS seller,
          MAX(subcategoria)       AS subcategoria,
          MAX(plataforma)         AS plataforma,
          ROUND(AVG(precio_venta)::numeric, 0)  AS precio_venta,
          ROUND(AVG(precio)::numeric, 0)        AS precio,
          ROUND(AVG(descuento)::numeric, 1)     AS descuento,
          MAX(url_producto)       AS url_producto,
          MAX(envio)              AS envio,
          MAX(tienda_oficial)     AS tienda_oficial,
          MAX("full")             AS full,
          MAX(oferta_relampago)   AS oferta_relampago,
          MAX(cuotas_sin_interes) AS cuotas_sin_interes,
          MAX(cupon)              AS cupon,
          ROUND(AVG(ranking)::numeric, 0)       AS best_ranking,
          COUNT(*) FILTER (WHERE pagina = 1)    AS appearances_p1,
          COUNT(*)                              AS appearances_total
        FROM eci.sos
        WHERE ${w} ${pageClause} AND id IS NOT NULL AND ranking IS NOT NULL ${sellerCond}
        GROUP BY id, ${NORM_SELLER}
        ORDER BY best_ranking DESC
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; titulo: string; marca: string; seller: string
        subcategoria: string; plataforma: string
        precio_venta: number; precio: number; descuento: number
        url_producto: string; envio: string; tienda_oficial: string
        full: string; oferta_relampago: string; cuotas_sin_interes: number; cupon: string
        best_ranking: number; appearances_p1: number; appearances_total: number
      }[]>(sql, ...p)
      return NextResponse.json(rows.map((r, i) => ({
        id:                r.id,
        rank:              i + 1,
        titulo:            r.titulo,
        marca:             r.marca,
        seller:            r.seller,
        subcategoria:      r.subcategoria,
        plataforma:        r.plataforma,
        precio_venta:      Number(r.precio_venta),
        precio:            Number(r.precio),
        descuento:         Number(r.descuento),
        url_producto:      r.url_producto,
        envio:             r.envio,
        tienda_oficial:    r.tienda_oficial,
        full:              r.full,
        oferta_relampago:  r.oferta_relampago,
        cuotas_sin_interes: r.cuotas_sin_interes != null ? Number(r.cuotas_sin_interes) : null,
        cupon:             r.cupon,
        ranking:           Number(r.best_ranking),
        appearances_p1:    Number(r.appearances_p1),
        appearances_total: Number(r.appearances_total),
      })))
    }

    // ── assortment ────────────────────────────────────────
    if (action === "assortment") {
      const limit    = Math.min(1000, parseInt(searchParams.get("limit") || "500", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const show     = searchParams.get("show") || "all" // "all" | "newsan" | "gaps"
      const p: unknown[] = [dateParam]
      let w = `DATE(fecha) = $1::date AND producto IS NOT NULL AND precio_venta IS NOT NULL`
      if (channel)  { p.push(channel);  w += ` AND plataforma = $${p.length}` }
      if (category) { p.push(category); w += ` AND subcategoria = $${p.length}` }
      const showFilter = show === "newsan" ? `ps.newsan_present = TRUE`
                       : show === "gaps"   ? `ps.newsan_present = FALSE`
                       : `TRUE`
      const sql = `
        WITH data AS (
          SELECT DISTINCT ON (id, (${NORM_SELLER}))
            id, producto, marca, subcategoria, plataforma,
            (${NORM_SELLER})                AS norm_seller,
            ROUND(precio_venta::numeric, 0) AS precio_venta
          FROM eci.sos
          WHERE ${w}
          ORDER BY id, (${NORM_SELLER}), ranking::numeric DESC NULLS LAST
        ),
        product_summary AS (
          SELECT
            id,
            MAX(producto)                                                       AS producto,
            MAX(marca)                                                          AS marca,
            MAX(subcategoria)                                                   AS subcategoria,
            MAX(plataforma)                                                     AS plataforma,
            COUNT(DISTINCT norm_seller)                                         AS total_sellers,
            MAX(CASE WHEN norm_seller = 'Newsan' THEN precio_venta END)         AS newsan_price,
            MIN(CASE WHEN norm_seller != 'Newsan' THEN precio_venta END)        AS comp_min_price,
            MAX(CASE WHEN norm_seller != 'Newsan' THEN precio_venta END)        AS comp_max_price,
            BOOL_OR(norm_seller = 'Newsan')                                     AS newsan_present,
            MIN(precio_venta)                                                   AS min_price
          FROM data
          GROUP BY id
        ),
        with_tier AS (
          SELECT *,
            NTILE(3) OVER (PARTITION BY subcategoria ORDER BY min_price)        AS tier_num
          FROM product_summary
        )
        SELECT
          id, producto, marca, subcategoria, plataforma,
          total_sellers, newsan_price, comp_min_price, comp_max_price, newsan_present,
          CASE tier_num WHEN 1 THEN 'Entry' WHEN 2 THEN 'Mid' ELSE 'Premium' END AS tier
        FROM with_tier ps
        WHERE ${showFilter}
        ORDER BY subcategoria, marca, producto
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
      const limit    = Math.min(500, parseInt(searchParams.get("limit") || "100", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const show     = searchParams.get("show") || "all" // "all" | "wins" | "loses" | "gaps"
      const p: unknown[] = [dateParam]
      let w = `DATE(fecha) = $1::date AND ranking IS NOT NULL AND id IS NOT NULL AND precio_venta IS NOT NULL`
      if (channel)  { p.push(channel);  w += ` AND plataforma = $${p.length}` }
      if (category) { p.push(category); w += ` AND subcategoria = $${p.length}` }
      const showFilter = show === "wins"  ? `w.winner_seller = 'Newsan'`
                       : show === "loses" ? `s.newsan_price IS NOT NULL AND w.winner_seller != 'Newsan'`
                       : show === "gaps"  ? `s.newsan_price IS NULL`
                       : `TRUE`
      const sql = `
        WITH normalized AS (
          SELECT
            id,
            producto,
            marca,
            subcategoria,
            plataforma,
            precio_venta::numeric   AS precio_venta,
            precio::numeric         AS precio,
            descuento::numeric      AS descuento,
            envio,
            url_producto,
            cuotas_sin_interes,
            ranking::numeric        AS ranking,
            (${NORM_SELLER})        AS norm_seller
          FROM eci.sos
          WHERE ${w}
        ),
        winner AS (
          SELECT DISTINCT ON (id)
            id,
            MAX(producto)    OVER (PARTITION BY id) AS producto,
            MAX(marca)       OVER (PARTITION BY id) AS marca,
            MAX(subcategoria) OVER (PARTITION BY id) AS subcategoria,
            MAX(plataforma)  OVER (PARTITION BY id) AS plataforma,
            norm_seller                              AS winner_seller,
            ROUND(precio_venta, 0)                   AS winner_price,
            ROUND(precio, 0)                         AS winner_precio_original,
            ROUND(descuento, 1)                      AS winner_descuento,
            envio                                    AS winner_envio,
            url_producto                             AS winner_url,
            ranking                                  AS winner_ranking
          FROM normalized
          ORDER BY id, ranking DESC NULLS LAST, precio_venta ASC
        ),
        stats AS (
          SELECT
            id,
            COUNT(DISTINCT norm_seller)                                           AS total_sellers,
            MAX(CASE WHEN norm_seller = 'Newsan' THEN ROUND(precio_venta, 0) END) AS newsan_price,
            MAX(CASE WHEN norm_seller = 'Newsan' THEN ranking END)                AS newsan_ranking,
            MAX(CASE WHEN norm_seller = 'Newsan' THEN envio END)                  AS newsan_envio,
            MAX(CASE WHEN norm_seller = 'Newsan' THEN cuotas_sin_interes END)     AS newsan_cuotas
          FROM normalized
          GROUP BY id
        )
        SELECT
          w.id, w.producto, w.marca, w.subcategoria, w.plataforma,
          w.winner_seller, w.winner_price, w.winner_precio_original,
          w.winner_descuento, w.winner_envio, w.winner_url, w.winner_ranking,
          s.total_sellers, s.newsan_price, s.newsan_ranking, s.newsan_envio, s.newsan_cuotas,
          (s.newsan_price IS NOT NULL) AS newsan_present,
          (w.winner_seller = 'Newsan') AS newsan_wins
        FROM winner w
        JOIN stats s ON s.id = w.id
        WHERE ${showFilter}
        ORDER BY w.winner_ranking DESC NULLS LAST
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; producto: string; marca: string; subcategoria: string; plataforma: string
        winner_seller: string; winner_price: number; winner_precio_original: number
        winner_descuento: number; winner_envio: string; winner_url: string; winner_ranking: number
        total_sellers: number; newsan_price: number | null; newsan_ranking: number | null
        newsan_envio: string | null; newsan_cuotas: string | number | null
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
        winner_precio_original: Number(r.winner_precio_original),
        winner_descuento:       Number(r.winner_descuento),
        winner_envio:           r.winner_envio,
        winner_url:             r.winner_url,
        winner_ranking:         Number(r.winner_ranking),
        total_sellers:          Number(r.total_sellers),
        newsan_price:           r.newsan_price    != null ? Number(r.newsan_price)    : null,
        newsan_ranking:         r.newsan_ranking  != null ? Number(r.newsan_ranking)  : null,
        newsan_envio:           r.newsan_envio,
        newsan_cuotas:          r.newsan_cuotas   != null ? Number(r.newsan_cuotas)   : null,
        newsan_present:         Boolean(r.newsan_present),
        newsan_wins:            Boolean(r.newsan_wins),
      })))
    }

    // ── price index ───────────────────────────────────────
    if (action === "price_index") {
      const limit    = Math.min(500, parseInt(searchParams.get("limit") || "200", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const show     = searchParams.get("show") || "newsan" // "newsan" | "gaps" | "all"
      const p: unknown[] = [dateParam]
      let w = `DATE(fecha) = $1::date AND precio_venta IS NOT NULL AND id IS NOT NULL`
      if (channel)  { p.push(channel);  w += ` AND plataforma = $${p.length}` }
      if (category) { p.push(category); w += ` AND subcategoria = $${p.length}` }
      const showFilter = show === "newsan" ? "AND newsan_price IS NOT NULL"
                       : show === "gaps"   ? "AND newsan_price IS NULL"
                       : ""
      const sql = `
        WITH normalized AS (
          SELECT
            id,
            producto,
            marca,
            subcategoria,
            plataforma,
            precio_venta::numeric          AS precio_venta,
            cuotas_sin_interes,
            (${NORM_SELLER})               AS norm_seller
          FROM eci.sos
          WHERE ${w}
        ),
        base AS (
          SELECT
            id,
            MAX(producto)                                                          AS producto,
            MAX(marca)                                                             AS marca,
            MAX(subcategoria)                                                      AS subcategoria,
            MAX(plataforma)                                                        AS plataforma,
            ROUND(AVG(precio_venta), 0)                                            AS avg_price,
            ROUND(MIN(precio_venta), 0)                                            AS min_price,
            ROUND(AVG(CASE WHEN norm_seller = 'Newsan' THEN precio_venta END), 0)  AS newsan_price,
            ROUND(AVG(CASE WHEN norm_seller != 'Newsan' THEN precio_venta END), 0) AS comp_avg_price,
            ROUND(MIN(CASE WHEN norm_seller != 'Newsan' THEN precio_venta END), 0) AS comp_min_price,
            COUNT(DISTINCT CASE WHEN norm_seller != 'Newsan' THEN norm_seller END) AS competitor_count,
            MAX(CASE WHEN norm_seller = 'Newsan' THEN cuotas_sin_interes END)      AS newsan_cuotas
          FROM normalized
          GROUP BY id
        )
        SELECT *,
          ROUND((newsan_price / NULLIF(comp_avg_price, 0)) * 100, 1) AS price_index
        FROM base
        WHERE avg_price IS NOT NULL ${showFilter}
        ORDER BY
          CASE WHEN newsan_price IS NOT NULL THEN 0 ELSE 1 END,
          (newsan_price / NULLIF(comp_avg_price, 0)) * 100 DESC NULLS LAST
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; producto: string; marca: string; subcategoria: string; plataforma: string
        avg_price: number; min_price: number
        newsan_price: number | null; comp_avg_price: number | null; comp_min_price: number | null
        competitor_count: number; newsan_cuotas: string | number | null; price_index: number | null
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        id:               r.id,
        producto:         r.producto,
        marca:            r.marca,
        subcategoria:     r.subcategoria,
        plataforma:       r.plataforma,
        avg_price:        Number(r.avg_price),
        min_price:        Number(r.min_price),
        newsan_price:     r.newsan_price    != null ? Number(r.newsan_price)    : null,
        comp_avg_price:   r.comp_avg_price  != null ? Number(r.comp_avg_price)  : null,
        comp_min_price:   r.comp_min_price  != null ? Number(r.comp_min_price)  : null,
        competitor_count: Number(r.competitor_count),
        newsan_cuotas:    r.newsan_cuotas   != null ? Number(r.newsan_cuotas)   : null,
        price_index:      r.price_index     != null ? Number(r.price_index)     : null,
      })))
    }

    // ── pricing live ──────────────────────────────────────
    if (action === "pricing") {
      const limit = Math.min(500, parseInt(searchParams.get("limit") || "100", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const p: unknown[] = [dateParam]
      let w = `DATE(fecha) = $1::date AND precio_venta IS NOT NULL`
      if (channel)  { p.push(channel);  w += ` AND plataforma = $${p.length}` }
      if (category) { p.push(category); w += ` AND subcategoria = $${p.length}` }
      const sellerCond = seller ? ` AND (${sellerInSql(seller, p)})` : ""
      const sql = `
        SELECT
          id,
          MAX(producto)                         AS producto,
          MAX(marca)                            AS marca,
          ${NORM_SELLER}                        AS seller,
          MAX(plataforma)                       AS plataforma,
          MAX(subcategoria)                     AS subcategoria,
          ROUND(AVG(precio_venta)::numeric, 0)  AS precio_venta,
          ROUND(AVG(precio)::numeric, 0)        AS precio,
          ROUND(AVG(descuento)::numeric, 1)     AS descuento,
          MAX(cuotas_sin_interes)               AS cuotas_sin_interes,
          MAX(envio)                            AS envio,
          MAX(tienda_oficial)                   AS tienda_oficial,
          MAX(url_producto)                     AS url_producto
        FROM eci.sos
        WHERE ${w} AND id IS NOT NULL ${sellerCond}
        GROUP BY id, ${NORM_SELLER}
        ORDER BY precio_venta ASC
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; producto: string; marca: string; seller: string
        plataforma: string; subcategoria: string
        precio_venta: number; precio: number; descuento: number
        cuotas_sin_interes: string | number | null; envio: string
        tienda_oficial: string; url_producto: string
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        id:                 r.id,
        producto:           r.producto,
        marca:              r.marca,
        seller:             r.seller,
        plataforma:         r.plataforma,
        subcategoria:       r.subcategoria,
        precio_venta:       Number(r.precio_venta),
        precio:             Number(r.precio),
        descuento:          Number(r.descuento),
        cuotas_sin_interes: r.cuotas_sin_interes != null ? Number(r.cuotas_sin_interes) : null,
        envio:              r.envio,
        tienda_oficial:     r.tienda_oficial,
        url_producto:       r.url_producto,
      })))
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
