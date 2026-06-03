/**
 * Insert missing Abbott brand entries into eci.marca_fabricante,
 * then rebuild the 6 affected materialized views.
 */
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

const MISSING = [
  { marca: "SIMILAC",                         pais: "MX" },
  { marca: "PEDIASURE",                        pais: "CO" },
  { marca: "SIMILAC",                         pais: "PE" },
  { marca: "GLUCERNA",                         pais: "CO" },
  { marca: "ENSURE",                           pais: "MX" },
  { marca: "PEDIASURE",                        pais: "MX" },
  { marca: "PEDIALYTE",                        pais: "PE" },
  { marca: "ENSURE ADVANCE",                   pais: "CO" },
  { marca: "PEDIALYTE",                        pais: "CO" },
  { marca: "PEDIALYTE ACTIVE",                 pais: "CO" },
  { marca: "GLUCERNA",                         pais: "MX" },
  { marca: "PEDIALYTE MAX 60",                 pais: "CO" },
  { marca: "PEDIASURE PEPTIGRO",               pais: "CO" },
  { marca: "ENSURE ADVANCE",                   pais: "MX" },
  { marca: "NEPRO",                            pais: "CO" },
  { marca: "NUTRAMIGEN",                       pais: "MX" },
  { marca: "PULMOCARE",                        pais: "CO" },
  { marca: "SIMILAC 5HMOS",                    pais: "CO" },
  { marca: "SIMILAC COMFORT",                  pais: "MX" },
  { marca: "PURAMINO",                         pais: "MX" },
  { marca: "PEDIALACT",                        pais: "PE" },
  { marca: "SIMILAC TOTAL COMFORT",            pais: "MX" },
  { marca: "ENSURE CLINICAL",                  pais: "CO" },
  { marca: "PEDIASURE 10+",                    pais: "CO" },
  { marca: "MORE",                             pais: "PE" },
  { marca: "PROSURE",                          pais: "CO" },
  { marca: "ENSURE PLUS",                      pais: "CO" },
  { marca: "NUTRAMIGEN",                       pais: "CO" },
  { marca: "PURAMINO",                         pais: "CO" },
  { marca: "ISOMIL",                           pais: "MX" },
  { marca: "PEDYALITE",                        pais: "CO" },
  { marca: "SIMILAC SENSITIVE",                pais: "MX" },
  { marca: "PULMOCARE",                        pais: "MX" },
  { marca: "SIMILAC NEOSURE",                  pais: "MX" },
  { marca: "ABBOTT LABORATORIES DE COLOMBIA",  pais: "CO" },
  { marca: "NEPRO",                            pais: "MX" },
  { marca: "NEPRO HP",                         pais: "MX" },
  { marca: "SIMILAC ARROZ",                    pais: "MX" },
  { marca: "PEDIASURE 10",                     pais: "CO" },
  { marca: "SIMILAC ISOMIL",                   pais: "MX" },
  { marca: "ENSURE ADVANCE",                   pais: "PE" },
  { marca: "NUTRAMIGEN",                       pais: "PE" },
  { marca: "PURAMINO",                         pais: "PE" },
  { marca: "PROSURE",                          pais: "MX" },
]

const FAB_LOOKUP = `(
  SELECT UPPER(marca) AS marca_upper, pais, MAX(fabricante) AS fabricante
  FROM eci.marca_fabricante
  WHERE fabricante IS NOT NULL AND fabricante != ''
  GROUP BY UPPER(marca), pais
) mf`

const FAB_EXPR = `CASE
        WHEN UPPER(COALESCE(s.fabricante, mf.fabricante, '')) LIKE '%ABBOT%' THEN 'ABBOTT'
        ELSE COALESCE(s.fabricante, mf.fabricante, 'MARCA LOCAL')
    END`

const MVS = [
  { name: "mv_search_daily_fab", sql: `
    SELECT s.fecha::date AS fecha, s.pais, s.retail, s.search,
        ${FAB_EXPR} AS fabricante,
        COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
        COUNT(*) AS count_total
    FROM eci.search s
    LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
    GROUP BY s.fecha::date, s.pais, s.retail, s.search, ${FAB_EXPR}` },
  { name: "mv_search_daily_marca", sql: `
    SELECT s.fecha::date AS fecha, s.pais, s.retail, s.search, s.marca,
        ${FAB_EXPR} AS fabricante,
        COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
        COUNT(*) AS count_total
    FROM eci.search s
    LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
    GROUP BY s.fecha::date, s.pais, s.retail, s.search, s.marca, ${FAB_EXPR}` },
  { name: "mv_sos_daily_fab", sql: `
    SELECT s.fecha::date AS fecha, s.retail, s.pais, s.categoria,
        ${FAB_EXPR} AS fabricante,
        COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
        COUNT(*) AS count_total
    FROM eci.sos s
    LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
    GROUP BY s.fecha::date, s.retail, s.pais, s.categoria, ${FAB_EXPR}` },
  { name: "mv_sos_daily_marca", sql: `
    SELECT s.fecha::date AS fecha, s.retail, s.pais, s.categoria,
        ${FAB_EXPR} AS fabricante, s.marca,
        COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
        COUNT(*) AS count_total
    FROM eci.sos s
    LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
    WHERE s.marca IS NOT NULL
    GROUP BY s.fecha::date, s.retail, s.pais, s.categoria, ${FAB_EXPR}, s.marca` },
  { name: "mv_sos_daily_titulo", sql: `
    SELECT s.fecha::date AS fecha, s.retail, s.pais, s.categoria,
        ${FAB_EXPR} AS fabricante, s.id AS producto_id,
        MAX(s.titulo) AS titulo, MIN(s.ranking) AS best_ranking,
        COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
        COUNT(*) AS count_total
    FROM eci.sos s
    LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
    WHERE s.titulo IS NOT NULL
    GROUP BY s.fecha::date, s.retail, s.pais, s.categoria, ${FAB_EXPR}, s.id` },
  { name: "mv_sos_product_latest", sql: `
    SELECT s.fecha::date AS fecha, s.retail, s.pais, s.categoria,
        s.id AS producto_id, ${FAB_EXPR} AS fabricante,
        MAX(s.titulo) AS titulo, MAX(s.marca) AS marca,
        ROUND(AVG(s.precio_venta), 0) AS precio_venta,
        ROUND(AVG(s.precio_neto), 0) AS precio_neto,
        ROUND(AVG(s.descuento), 1) AS descuento,
        MIN(s.ranking) AS best_ranking, MAX(s.pagina) AS max_pagina,
        COUNT(*) FILTER (WHERE s.pagina = 1) AS appearances_p1,
        COUNT(*) AS appearances_total,
        MAX(s.url_producto) AS url_producto, MAX(s.presentacion) AS presentacion,
        MAX(s.promocion) AS promocion, BOOL_OR(s.en_stock) AS en_stock
    FROM eci.sos s
    LEFT JOIN ${FAB_LOOKUP} ON UPPER(s.marca) = mf.marca_upper AND s.pais = mf.pais
    WHERE s.id IS NOT NULL AND s.precio_venta IS NOT NULL
    GROUP BY s.fecha::date, s.retail, s.pais, s.categoria, s.id, ${FAB_EXPR}` },
]

async function main() {
  // Step 1: Insert missing Abbott entries
  console.log(`\nInserting ${MISSING.length} missing Abbott entries into marca_fabricante...`)
  let inserted = 0
  for (const { marca, pais } of MISSING) {
    try {
      await p.$queryRawUnsafe(
        `INSERT INTO eci.marca_fabricante (marca, pais, fabricante)
         VALUES ($1, $2, 'ABBOTT')
         ON CONFLICT (marca, pais) DO UPDATE SET fabricante = 'ABBOTT'`,
        marca, pais
      )
      inserted++
    } catch (e) {
      // No unique constraint — do a plain insert if ON CONFLICT fails
      try {
        await p.$queryRawUnsafe(
          `INSERT INTO eci.marca_fabricante (marca, pais, fabricante)
           SELECT $1, $2, 'ABBOTT'
           WHERE NOT EXISTS (
             SELECT 1 FROM eci.marca_fabricante
             WHERE UPPER(marca) = UPPER($1) AND pais = $2
           )`,
          marca, pais
        )
        inserted++
      } catch (e2) {
        console.warn(`  SKIP ${pais} ${marca}: ${e2.message}`)
      }
    }
  }
  console.log(`  Inserted/updated: ${inserted}`)

  // Step 2: Rebuild all 6 MVs
  console.log("\nRebuilding materialized views...")
  for (const mv of MVS) {
    process.stdout.write(`  ${mv.name} ... `)
    await p.$queryRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.${mv.name} CASCADE`)
    await p.$queryRawUnsafe(`CREATE MATERIALIZED VIEW eci.${mv.name} AS ${mv.sql}`)
    console.log("OK")
  }

  // Step 3: Verify
  console.log("\n=== mv_search_daily_fab — top fabricantes ===")
  const r = await p.$queryRawUnsafe(`
    SELECT fabricante, SUM(count_p1)::int AS total_p1
    FROM eci.mv_search_daily_fab
    GROUP BY fabricante ORDER BY total_p1 DESC LIMIT 15
  `)
  r.forEach(row => console.log(String(row.total_p1).padStart(8), row.fabricante))

  await p.$disconnect()
  console.log("\nDone.")
}

main().catch(e => { console.error(e.message); process.exit(1) })
