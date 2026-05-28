import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

// SQL CASE to unify Abbott fabricante variants into "ABBOTT"
const FABRICANTE_UNIFIED = `CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END`

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

  try {
    // ── date range ────────────────────────────────────────
    if (action === "dates") {
      if (channel) {
        const rows = await prisma.$queryRawUnsafe<{ min_d: Date; max_d: Date }[]>(
          `SELECT MIN(DATE(fecha))::date AS min_d, MAX(DATE(fecha))::date AS max_d FROM eci.sos WHERE retail = $1`,
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

    // ── sellers list (fabricantes unified) ─────────────────
    if (action === "sellers_list") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const sql = `SELECT DISTINCT ${FABRICANTE_UNIFIED} AS n FROM eci.sos WHERE ${w} AND fabricante IS NOT NULL ORDER BY 1`
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── categories list ───────────────────────────────────
    if (action === "categories") {
      const p: unknown[] = [startD, endD]
      let sql = `SELECT DISTINCT categoria AS n FROM eci.sos
                 WHERE fecha >= $1 AND fecha <= $2 AND categoria IS NOT NULL`
      if (channel) { sql += ` AND retail = $${p.length + 1}`; p.push(channel) }
      if (country) { sql += ` AND pais = $${p.length + 1}`; p.push(country) }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── channels list (retailers) ─────────────────────────
    if (action === "channels") {
      const p: unknown[] = [startD, endD]
      let sql = `SELECT DISTINCT retail AS n FROM eci.sos
                 WHERE fecha >= $1 AND fecha <= $2 AND retail IS NOT NULL`
      if (category) { sql += ` AND categoria = $${p.length + 1}`; p.push(category) }
      if (country)  { sql += ` AND pais = $${p.length + 1}`; p.push(country) }
      sql += " ORDER BY 1"
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── countries list ────────────────────────────────────
    if (action === "countries") {
      const rows = await prisma.$queryRaw<{ n: string }[]>`
        SELECT DISTINCT pais AS n FROM eci.sos WHERE pais IS NOT NULL ORDER BY 1
      `
      return NextResponse.json(rows.map(r => r.n))
    }

    // ── sellers (fabricante) SOS overview ──────────────────
    if (action === "sellers") {
      const p: unknown[] = []
      const w = buildWhere(p)
      const sql = `
        WITH base AS (
          SELECT ${FABRICANTE_UNIFIED} AS fab, pagina FROM eci.sos WHERE ${w} AND fabricante IS NOT NULL
        ),
        total_p1  AS (SELECT COUNT(*) AS t FROM base WHERE pagina = 1),
        total_all AS (SELECT COUNT(*) AS t FROM base),
        per_fab AS (
          SELECT fab,
            COUNT(*) FILTER (WHERE pagina = 1) AS products_p1,
            COUNT(*) AS products_total
          FROM base GROUP BY fab
        )
        SELECT s.fab AS seller,
          s.products_p1::int, s.products_total::int,
          ROUND(s.products_p1 * 100.0 / NULLIF(tp.t, 0), 2) AS sos_p1,
          ROUND(s.products_total * 100.0 / NULLIF(ta.t, 0), 2) AS sos_total
        FROM per_fab s, total_p1 tp, total_all ta
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
        color:            PALETTE[i % PALETTE.length],
        rank:             i + 1,
      })))
    }

    // ── brand-level breakdown (marca within a given fabricante) ──
    if (action === "brands") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p)
      p.push(seller)
      const sellerCond = seller === "ABBOTT"
        ? `${ABBOTT_LIKE}`
        : `fabricante = $${p.length}`
      // If seller is ABBOTT, pop the unused param
      if (seller === "ABBOTT") p.pop()
      const sql = `
        WITH base AS (
          SELECT marca, pagina FROM eci.sos
          WHERE ${w} AND ${sellerCond} AND marca IS NOT NULL
        ),
        total_p1  AS (SELECT COUNT(*) AS t FROM base WHERE pagina = 1),
        total_all AS (SELECT COUNT(*) AS t FROM base),
        per_marca AS (
          SELECT marca,
            COUNT(*) FILTER (WHERE pagina = 1) AS products_p1,
            COUNT(*) AS products_total
          FROM base GROUP BY marca
        )
        SELECT b.marca AS brand,
          b.products_p1::int, b.products_total::int,
          ROUND(b.products_p1 * 100.0 / NULLIF(tp.t, 0), 2) AS sos_p1,
          ROUND(b.products_total * 100.0 / NULLIF(ta.t, 0), 2) AS sos_total
        FROM per_marca b, total_p1 tp, total_all ta
        ORDER BY sos_p1 DESC
        LIMIT 50
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

    // ── título breakdown (by fabricante) ────────────────────
    if (action === "titulos") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p)
      p.push(seller)
      const sellerCond = seller === "ABBOTT"
        ? `${ABBOTT_LIKE}`
        : `fabricante = $${p.length}`
      if (seller === "ABBOTT") p.pop()
      const sql = `
        WITH base AS (
          SELECT id, titulo, pagina, ranking FROM eci.sos
          WHERE ${w} AND ${sellerCond} AND titulo IS NOT NULL
        ),
        total_p1  AS (SELECT COUNT(*) AS t FROM base WHERE pagina = 1),
        total_all AS (SELECT COUNT(*) AS t FROM base),
        per_titulo AS (
          SELECT id, MAX(titulo) AS titulo,
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
        ranking_pos:      r.best_ranking != null ? Number(r.best_ranking) : null,
        products_p1:      Number(r.products_p1),
      })))
    }

    // ── trend diario por marca ────────────────────────────
    if (action === "trend") {
      const sellerList = sellersParam.length ? sellersParam : []
      if (sellerList.length === 0) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p)
      const sellerPlaceholders = sellerList.map((_, i) => `$${p.length + i + 1}`).join(", ")
      sellerList.forEach(s => p.push(s))
      const sql = `
        WITH base AS (
          SELECT DATE(fecha) AS day, ${FABRICANTE_UNIFIED} AS fab, pagina FROM eci.sos
          WHERE ${w} AND fabricante IS NOT NULL
        ),
        daily_total AS (
          SELECT day, COUNT(*) FILTER (WHERE pagina = 1) AS total_p1
          FROM base GROUP BY day
        ),
        seller_daily AS (
          SELECT day, fab, COUNT(*) FILTER (WHERE pagina = 1) AS products_p1
          FROM base WHERE fab IN (${sellerPlaceholders})
          GROUP BY day, fab
        )
        SELECT sd.day::text, sd.fab AS seller,
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

    // ── SOS by channel (retail) for a single fabricante ──
    if (action === "by_channel") {
      if (!seller) return NextResponse.json([])
      const p: unknown[] = []
      const w = buildWhere(p, { channel: false, category: true, country: true })
      const sellerCond = seller === "ABBOTT"
        ? ABBOTT_LIKE
        : (() => { p.push(seller); return `fabricante = $${p.length}` })()
      const sql = `
        WITH base AS (
          SELECT retail, pagina,
            CASE WHEN ${sellerCond} THEN 1 ELSE 0 END AS is_seller
          FROM eci.sos WHERE ${w} AND retail IS NOT NULL
        )
        SELECT retail AS channel,
          ROUND(
            SUM(CASE WHEN is_seller = 1 AND pagina = 1 THEN 1 ELSE 0 END) * 100.0
            / NULLIF(SUM(CASE WHEN pagina = 1 THEN 1 ELSE 0 END), 0), 2
          ) AS sos_p1,
          ROUND(
            SUM(CASE WHEN is_seller = 1 THEN 1 ELSE 0 END) * 100.0
            / NULLIF(COUNT(*), 0), 2
          ) AS sos_total
        FROM base
        GROUP BY retail
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

    // ── ranking ──────────────────────────────────────────
    if (action === "ranking") {
      const pageFilter = searchParams.get("page_filter") || "all"
      const limit = Math.min(200, parseInt(searchParams.get("limit") || "50", 10))
      const p: unknown[] = []
      const w = buildWhere(p)
      const pageClause = pageFilter === "p1" ? "AND pagina = 1" : ""
      let sellerCond = ""
      if (seller) {
        if (seller === "ABBOTT") { sellerCond = ` AND ${ABBOTT_LIKE}` }
        else { p.push(seller); sellerCond = ` AND fabricante = $${p.length}` }
      }
      const sql = `
        SELECT
          id,
          MAX(titulo) AS titulo,
          MAX(marca) AS marca,
          MAX(retail) AS seller,
          MAX(fabricante) AS fabricante,
          ROUND(AVG(ranking)) AS best_ranking,
          COUNT(*) FILTER (WHERE pagina = 1) AS appearances_p1,
          COUNT(*) AS appearances_total
        FROM eci.sos
        WHERE ${w} ${pageClause} AND id IS NOT NULL AND ranking IS NOT NULL ${sellerCond}
        GROUP BY id
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

    // ── bestsellers ────────────────────────────────────────
    if (action === "bestsellers") {
      const pageFilter = searchParams.get("page_filter") || "p1"
      const limit = Math.min(100, parseInt(searchParams.get("limit") || "20", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const p: unknown[] = [dateParam]
      let w = `DATE(fecha) = $1::date`
      if (channel)  { p.push(channel);  w += ` AND retail = $${p.length}` }
      if (category) { p.push(category); w += ` AND categoria = $${p.length}` }
      if (country)  { p.push(country);  w += ` AND pais = $${p.length}` }
      const pageClause = pageFilter === "p1" ? "AND pagina = 1" : ""
      let sellerCond = ""
      if (seller) {
        if (seller === "ABBOTT") { sellerCond = ` AND ${ABBOTT_LIKE}` }
        else { p.push(seller); sellerCond = ` AND fabricante = $${p.length}` }
      }
      const sql = `
        SELECT
          id,
          MAX(titulo) AS titulo,
          MAX(marca) AS marca,
          MAX(retail) AS seller,
          MAX(fabricante) AS fabricante,
          MAX(categoria) AS categoria,
          MAX(retail) AS retail,
          ROUND(AVG(precio_venta)::numeric, 0) AS precio_venta,
          ROUND(AVG(precio_neto)::numeric, 0) AS precio_neto,
          ROUND(AVG(descuento)::numeric, 1) AS descuento,
          MAX(url_producto) AS url_producto,
          MAX(presentacion) AS presentacion,
          MAX(promocion) AS promocion,
          ROUND(AVG(ranking)::numeric, 0) AS best_ranking,
          COUNT(*) FILTER (WHERE pagina = 1) AS appearances_p1,
          COUNT(*) AS appearances_total
        FROM eci.sos
        WHERE ${w} ${pageClause} AND id IS NOT NULL AND ranking IS NOT NULL ${sellerCond}
        GROUP BY id
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

    // ── inventory ────────────────────────────────────────
    if (action === "inventory") {
      const limit      = Math.min(1000, parseInt(searchParams.get("limit") || "200", 10))
      const dateParam  = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const show       = searchParams.get("show") || "all"
      const lookback   = Math.min(30, parseInt(searchParams.get("lookback") || "7", 10))
      const onlyAbbott = searchParams.get("onlyNewsan") === "1"
      const p: unknown[] = [dateParam]
      let wCond = `titulo IS NOT NULL AND precio_venta IS NOT NULL`
      if (channel)    { p.push(channel);  wCond += ` AND retail = $${p.length}` }
      if (category)   { p.push(category); wCond += ` AND categoria = $${p.length}` }
      if (country)    { p.push(country);  wCond += ` AND pais = $${p.length}` }
      if (onlyAbbott) { wCond += ` AND ${ABBOTT_LIKE}` }

      const todaySub = `
        SELECT id, marca, retail,
          MAX(titulo) AS titulo, MAX(fabricante) AS fabricante,
          MAX(categoria) AS categoria,
          ROUND(MAX(precio_venta::numeric), 0) AS precio_venta
        FROM eci.sos
        WHERE DATE(fecha) = $1::date AND ${wCond}
        GROUP BY id, marca, retail
      `
      const lbSub = `
        SELECT id, marca, retail,
          MAX(titulo) AS titulo, MAX(fabricante) AS fabricante,
          MAX(categoria) AS categoria,
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
          (${ABBOTT_LIKE.replace('fabricante', 't.fabricante')}) AS is_newsan
        FROM (${todaySub}) t
        LEFT JOIN (${lbSub}) lb ON lb.id = t.id AND lb.marca = t.marca AND lb.retail = t.retail
      `
      const breakSQL = `
        SELECT lb.id, lb.titulo AS producto, lb.marca, lb.categoria AS subcategoria,
          lb.retail AS plataforma, lb.marca AS norm_seller,
          NULL::numeric AS precio_venta, lb.last_seen, lb.days_seen,
          'break'::text AS stock_status,
          (${ABBOTT_LIKE.replace('fabricante', 'lb.fabricante')}) AS is_newsan
        FROM (${lbSub}) lb
        LEFT JOIN (${todaySub}) tod ON tod.id = lb.id AND tod.marca = lb.marca AND tod.retail = lb.retail
        WHERE tod.id IS NULL
      `
      const unionSQL = show === "in_stock" ? inStockSQL
                     : show === "break"    ? breakSQL
                     : `${inStockSQL} UNION ALL ${breakSQL}`
      const sql = `
        SELECT * FROM (${unionSQL}) combined
        ORDER BY
          CASE stock_status WHEN 'break' THEN 0 ELSE 1 END,
          is_newsan DESC,
          last_seen DESC NULLS LAST,
          subcategoria, marca, producto
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; producto: string; marca: string; subcategoria: string; plataforma: string
        norm_seller: string; precio_venta: number | null; last_seen: string | null
        days_seen: number; stock_status: string; is_newsan: boolean
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

      const sql = `
        WITH
        latest_date AS (
          SELECT MAX(DATE(s.fecha)) AS max_date
          FROM eci.sos s
          WHERE s.id IS NOT NULL AND s.precio_venta IS NOT NULL AND s.ranking IS NOT NULL
            ${channelSql} ${categorySql} ${countrySql}
        ),
        abbott_present_7d AS (
          SELECT DISTINCT s.id
          FROM eci.sos s, latest_date
          WHERE s.fecha >= latest_date.max_date - INTERVAL '6 days'
            AND s.fecha < latest_date.max_date + INTERVAL '1 day'
            AND s.id IS NOT NULL AND s.precio_venta IS NOT NULL AND s.ranking IS NOT NULL
            AND ${ABBOTT_LIKE.replace('fabricante', 's.fabricante')}
            ${channelSql} ${categorySql} ${countrySql}
        ),
        raw_latest AS (
          SELECT
            s.id, s.titulo, s.marca, s.categoria, s.retail, s.fabricante,
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
            ${channelSql} ${categorySql} ${countrySql}
        ),
        latest_winners AS (
          SELECT id, titulo AS producto, marca, categoria AS subcategoria,
                 retail AS plataforma, marca AS winner_seller,
                 precio_venta AS winner_price, url_producto AS winner_url
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
          (SELECT max_date::text FROM latest_date) AS latest_date
        FROM abbott_present_7d ap
        JOIN latest_winners lw ON lw.id = ap.id
        LEFT JOIN abbott_latest al ON al.id = ap.id
        ORDER BY ROUND(lw.winner_price, 0) DESC NULLS LAST
        LIMIT $1
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; producto: string; marca: string; subcategoria: string; plataforma: string
        winner_seller: string; winner_price: number; winner_url: string | null
        newsan_price: number | null; newsan_wins: boolean; latest_date: string
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
    if (action === "pricing") {
      const limit = Math.min(500, parseInt(searchParams.get("limit") || "100", 10))
      const dateParam = searchParams.get("date") || endDate || new Date().toISOString().split("T")[0]
      const p: unknown[] = [dateParam]
      let w = `DATE(fecha) = $1::date AND precio_venta IS NOT NULL`
      if (channel)  { p.push(channel);  w += ` AND retail = $${p.length}` }
      if (category) { p.push(category); w += ` AND categoria = $${p.length}` }
      if (country)  { p.push(country);  w += ` AND pais = $${p.length}` }
      let sellerCond = ""
      if (seller) {
        if (seller === "ABBOTT") { sellerCond = ` AND ${ABBOTT_LIKE}` }
        else { p.push(seller); sellerCond = ` AND fabricante = $${p.length}` }
      }
      const sql = `
        SELECT
          id,
          MAX(titulo) AS producto,
          MAX(marca) AS marca,
          MAX(retail) AS seller,
          MAX(retail) AS plataforma,
          MAX(categoria) AS subcategoria,
          MAX(fabricante) AS fabricante,
          ROUND(AVG(precio_venta)::numeric, 0) AS precio_venta,
          ROUND(AVG(precio_neto)::numeric, 0) AS precio,
          ROUND(AVG(descuento)::numeric, 1) AS descuento,
          MAX(promocion) AS promocion,
          MAX(presentacion) AS presentacion,
          MAX(url_producto) AS url_producto
        FROM eci.sos
        WHERE ${w} AND id IS NOT NULL ${sellerCond}
        GROUP BY id, marca
        ORDER BY precio_venta ASC
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe<{
        id: string; producto: string; marca: string; seller: string
        plataforma: string; subcategoria: string; fabricante: string
        precio_venta: number; precio: number; descuento: number
        promocion: string | null; presentacion: string | null; url_producto: string
      }[]>(sql, ...p)
      return NextResponse.json(rows.map(r => ({
        id:                      r.id,
        producto:                r.producto,
        marca:                   r.marca,
        seller:                  r.seller,
        plataforma:              r.plataforma,
        subcategoria:            r.subcategoria,
        fabricante:              r.fabricante,
        precio_venta:            Number(r.precio_venta),
        precio:                  r.precio != null ? Number(r.precio) : null,
        descuento:               Number(r.descuento),
        cuotas_sin_interes:      null,
        tiene_cuotas_sin_interes: null,
        detalle_cuotas:          null,
        oferta_relampago:        null,
        cupon:                   null,
        full_ml:                 null,
        envio:                   null,
        tienda_oficial:          null,
        url_producto:            r.url_producto,
        promocion:               r.promocion,
        presentacion:            r.presentacion,
      })))
    }

    // ── marca_fabricante ──────────────────────────────────
    if (action === "marca_fabricante") {
      const p: unknown[] = []
      let w = "1=1"
      if (country) { p.push(country); w += ` AND mf.pais = $${p.length}` }
      const sql = `
        SELECT mf.marca, mf.pais, mf.fabricante, mf.n_apariciones,
               mf.segmento, mf.mercado
        FROM eci.marca_fabricante mf
        WHERE ${w}
        ORDER BY mf.n_apariciones DESC
        LIMIT 500
      `
      const rows = await prisma.$queryRawUnsafe<{
        marca: string; pais: string; fabricante: string; n_apariciones: number
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
