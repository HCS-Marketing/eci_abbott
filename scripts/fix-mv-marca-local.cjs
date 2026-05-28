const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const CASE_EXPR = `CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END`

  // MV1: daily_fab
  console.log('Recreating mv_sos_daily_fab...')
  await p.$queryRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_daily_fab CASCADE`)
  await p.$queryRawUnsafe(`
    CREATE MATERIALIZED VIEW eci.mv_sos_daily_fab AS
    SELECT fecha::date AS fecha, retail, pais, categoria,
      ${CASE_EXPR} AS fabricante,
      COUNT(*) FILTER (WHERE pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.sos
    GROUP BY fecha::date, retail, pais, categoria, ${CASE_EXPR}
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_fecha ON eci.mv_sos_daily_fab (fecha)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_retail ON eci.mv_sos_daily_fab (retail)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_pais ON eci.mv_sos_daily_fab (pais)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_cat ON eci.mv_sos_daily_fab (categoria)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_fab ON eci.mv_sos_daily_fab (fabricante)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_composite ON eci.mv_sos_daily_fab (fecha, retail, pais, categoria)`)
  console.log('  Done!')

  // MV2: daily_marca
  console.log('Recreating mv_sos_daily_marca...')
  await p.$queryRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_daily_marca CASCADE`)
  await p.$queryRawUnsafe(`
    CREATE MATERIALIZED VIEW eci.mv_sos_daily_marca AS
    SELECT fecha::date AS fecha, retail, pais, categoria,
      ${CASE_EXPR} AS fabricante,
      marca,
      COUNT(*) FILTER (WHERE pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.sos
    WHERE marca IS NOT NULL
    GROUP BY fecha::date, retail, pais, categoria, ${CASE_EXPR}, marca
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_marca_composite ON eci.mv_sos_daily_marca (fecha, retail, pais, categoria, fabricante)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_marca_fab ON eci.mv_sos_daily_marca (fabricante)`)
  console.log('  Done!')

  // MV3: daily_titulo
  console.log('Recreating mv_sos_daily_titulo...')
  await p.$queryRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_daily_titulo CASCADE`)
  await p.$queryRawUnsafe(`
    CREATE MATERIALIZED VIEW eci.mv_sos_daily_titulo AS
    SELECT fecha::date AS fecha, retail, pais, categoria,
      ${CASE_EXPR} AS fabricante,
      id AS producto_id,
      MAX(titulo) AS titulo,
      MIN(ranking) AS best_ranking,
      COUNT(*) FILTER (WHERE pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.sos
    WHERE titulo IS NOT NULL
    GROUP BY fecha::date, retail, pais, categoria, ${CASE_EXPR}, id
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_titulo_composite ON eci.mv_sos_daily_titulo (fecha, retail, pais, categoria, fabricante)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_titulo_fab ON eci.mv_sos_daily_titulo (fabricante)`)
  console.log('  Done!')

  // Verify
  const mx = await p.$queryRawUnsafe(`
    SELECT fabricante, SUM(count_total) AS total 
    FROM eci.mv_sos_daily_fab WHERE pais = 'MX' 
    GROUP BY fabricante ORDER BY total DESC LIMIT 5
  `)
  console.log('\nMX fabricantes:')
  console.table(mx)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
