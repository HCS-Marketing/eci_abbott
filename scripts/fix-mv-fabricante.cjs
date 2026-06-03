/**
 * Rebuild all 6 fabricante-related materialized views to JOIN eci.marca_fabricante
 * so NULL fabricante values resolve properly instead of falling back to 'MARCA LOCAL'.
 *
 * Run: DATABASE_URL=... node scripts/fix-mv-fabricante.cjs
 */
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

// Deduplicated lookup subquery — safe against duplicate (marca, pais) pairs
const FAB_LOOKUP = `(
  SELECT UPPER(marca) AS marca_upper, pais, MAX(fabricante) AS fabricante
  FROM eci.marca_fabricante
  WHERE fabricante IS NOT NULL AND fabricante != ''
  GROUP BY UPPER(marca), pais
) mf`

// The fabricante resolution expression (used in SELECT and GROUP BY)
const FAB_EXPR_SOS = `CASE
        WHEN UPPER(COALESCE(s.fabricante, mf.fabricante, '')) LIKE '%ABBOT%' THEN 'ABBOTT'
        ELSE COALESCE(s.fabricante, mf.fabricante, 'MARCA LOCAL')
    END`

const FAB_EXPR_SEARCH = `CASE
        WHEN UPPER(COALESCE(s.fabricante, mf.fabricante, '')) LIKE '%ABBOT%' THEN 'ABBOTT'
        ELSE COALESCE(s.fabricante, mf.fabricante, 'MARCA LOCAL')
    END`

const MVS = [
  {
    name: "mv_search_daily_fab",
    sql: `
      SELECT s.fecha::date AS fecha,
          s.pais, s.retail, s.search,
          ${FAB_EXPR_SEARCH} AS fabricante,
          COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
          COUNT(*) AS count_total
      FROM eci.search s
      LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
      GROUP BY s.fecha::date, s.pais, s.retail, s.search, ${FAB_EXPR_SEARCH}
    `,
  },
  {
    name: "mv_search_daily_marca",
    sql: `
      SELECT s.fecha::date AS fecha,
          s.pais, s.retail, s.search, s.marca,
          ${FAB_EXPR_SEARCH} AS fabricante,
          COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
          COUNT(*) AS count_total
      FROM eci.search s
      LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
      GROUP BY s.fecha::date, s.pais, s.retail, s.search, s.marca, ${FAB_EXPR_SEARCH}
    `,
  },
  {
    name: "mv_sos_daily_fab",
    sql: `
      SELECT s.fecha::date AS fecha,
          s.retail, s.pais, s.categoria,
          ${FAB_EXPR_SOS} AS fabricante,
          COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
          COUNT(*) AS count_total
      FROM eci.sos s
      LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
      GROUP BY s.fecha::date, s.retail, s.pais, s.categoria, ${FAB_EXPR_SOS}
    `,
  },
  {
    name: "mv_sos_daily_marca",
    sql: `
      SELECT s.fecha::date AS fecha,
          s.retail, s.pais, s.categoria,
          ${FAB_EXPR_SOS} AS fabricante,
          s.marca,
          COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
          COUNT(*) AS count_total
      FROM eci.sos s
      LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
      WHERE s.marca IS NOT NULL
      GROUP BY s.fecha::date, s.retail, s.pais, s.categoria, ${FAB_EXPR_SOS}, s.marca
    `,
  },
  {
    name: "mv_sos_daily_titulo",
    sql: `
      SELECT s.fecha::date AS fecha,
          s.retail, s.pais, s.categoria,
          ${FAB_EXPR_SOS} AS fabricante,
          s.id AS producto_id,
          MAX(s.titulo) AS titulo,
          MIN(s.ranking) AS best_ranking,
          COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
          COUNT(*) AS count_total
      FROM eci.sos s
      LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
      WHERE s.titulo IS NOT NULL
      GROUP BY s.fecha::date, s.retail, s.pais, s.categoria, ${FAB_EXPR_SOS}, s.id
    `,
  },
  {
    name: "mv_sos_product_latest",
    sql: `
      SELECT s.fecha::date AS fecha,
          s.retail, s.pais, s.categoria,
          s.id AS producto_id,
          ${FAB_EXPR_SOS} AS fabricante,
          MAX(s.titulo) AS titulo,
          MAX(s.marca) AS marca,
          ROUND(AVG(s.precio_venta), 0) AS precio_venta,
          ROUND(AVG(s.precio_neto), 0) AS precio_neto,
          ROUND(AVG(s.descuento), 1) AS descuento,
          MIN(s.ranking) AS best_ranking,
          MAX(s.pagina) AS max_pagina,
          COUNT(*) FILTER (WHERE s.pagina = 1) AS appearances_p1,
          COUNT(*) AS appearances_total,
          MAX(s.url_producto) AS url_producto,
          MAX(s.presentacion) AS presentacion,
          MAX(s.promocion) AS promocion,
          BOOL_OR(s.en_stock) AS en_stock
      FROM eci.sos s
      LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
      WHERE s.id IS NOT NULL AND s.precio_venta IS NOT NULL
      GROUP BY s.fecha::date, s.retail, s.pais, s.categoria, s.id, ${FAB_EXPR_SOS}
    `,
  },
]

async function main() {
  for (const mv of MVS) {
    process.stdout.write(`Rebuilding ${mv.name} ... `)
    try {
      await p.$queryRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.${mv.name} CASCADE`)
      await p.$queryRawUnsafe(`CREATE MATERIALIZED VIEW eci.${mv.name} AS ${mv.sql}`)
      console.log("OK")
    } catch (e) {
      console.log("FAILED")
      console.error("  ", e.message)
      process.exit(1)
    }
  }

  // Verify new row counts
  console.log("\n=== Post-rebuild MARCA LOCAL check ===")
  try {
    const r1 = await p.$queryRawUnsafe(`
      SELECT fabricante, SUM(count_p1)::int AS total_p1
      FROM eci.mv_search_daily_fab
      GROUP BY fabricante ORDER BY total_p1 DESC LIMIT 20
    `)
    r1.forEach(r => console.log(String(r.total_p1).padStart(8), r.fabricante))
  } catch (e) {
    console.error("Verification failed:", e.message)
  }

  await p.$disconnect()
  console.log("\nDone.")
}

main().catch(e => { console.error(e.message); process.exit(1) })
