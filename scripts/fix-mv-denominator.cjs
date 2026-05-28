const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  console.log('=== Fixing MVs: include ALL products in denominator ===\n')

  // MV1: Include NULL fabricante as 'DESCONOCIDO' — no WHERE filter on fabricante
  console.log('Recreating mv_sos_daily_fab (including NULL fabricante)...')
  await p.$queryRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_daily_fab CASCADE`)
  await p.$queryRawUnsafe(`
    CREATE MATERIALIZED VIEW eci.mv_sos_daily_fab AS
    SELECT
      fecha::date AS fecha,
      retail,
      pais,
      categoria,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END AS fabricante,
      COUNT(*) FILTER (WHERE pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.sos
    GROUP BY fecha::date, retail, pais, categoria,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_fecha ON eci.mv_sos_daily_fab (fecha)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_retail ON eci.mv_sos_daily_fab (retail)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_pais ON eci.mv_sos_daily_fab (pais)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_cat ON eci.mv_sos_daily_fab (categoria)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_fab ON eci.mv_sos_daily_fab (fabricante)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_fab_composite ON eci.mv_sos_daily_fab (fecha, retail, pais, categoria)`)
  console.log('  Done!')

  // MV2: marca view — keep marca IS NOT NULL (needed for brand drill-down) but remove fabricante IS NOT NULL
  console.log('Recreating mv_sos_daily_marca (remove fabricante NOT NULL filter)...')
  await p.$queryRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_daily_marca CASCADE`)
  await p.$queryRawUnsafe(`
    CREATE MATERIALIZED VIEW eci.mv_sos_daily_marca AS
    SELECT
      fecha::date AS fecha,
      retail,
      pais,
      categoria,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END AS fabricante,
      marca,
      COUNT(*) FILTER (WHERE pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.sos
    WHERE marca IS NOT NULL
    GROUP BY fecha::date, retail, pais, categoria,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END,
      marca
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_marca_composite ON eci.mv_sos_daily_marca (fecha, retail, pais, categoria, fabricante)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_marca_fab ON eci.mv_sos_daily_marca (fabricante)`)
  console.log('  Done!')

  // MV3: titulo view — remove fabricante IS NOT NULL
  console.log('Recreating mv_sos_daily_titulo (remove fabricante NOT NULL filter)...')
  await p.$queryRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_daily_titulo CASCADE`)
  await p.$queryRawUnsafe(`
    CREATE MATERIALIZED VIEW eci.mv_sos_daily_titulo AS
    SELECT
      fecha::date AS fecha,
      retail,
      pais,
      categoria,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END AS fabricante,
      id AS producto_id,
      MAX(titulo) AS titulo,
      MIN(ranking) AS best_ranking,
      COUNT(*) FILTER (WHERE pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.sos
    WHERE titulo IS NOT NULL
    GROUP BY fecha::date, retail, pais, categoria,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END,
      id
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_titulo_composite ON eci.mv_sos_daily_titulo (fecha, retail, pais, categoria, fabricante)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_titulo_fab ON eci.mv_sos_daily_titulo (fabricante)`)
  console.log('  Done!')

  // Verify counts
  const counts = await p.$queryRawUnsafe(`
    SELECT 'mv_sos_daily_fab' AS view, COUNT(*) AS rows FROM eci.mv_sos_daily_fab
    UNION ALL SELECT 'mv_sos_daily_marca', COUNT(*) FROM eci.mv_sos_daily_marca
    UNION ALL SELECT 'mv_sos_daily_titulo', COUNT(*) FROM eci.mv_sos_daily_titulo
  `)
  console.log('\n=== Row Counts ===')
  console.table(counts)

  // Verify MX now has multiple fabricantes
  const mx = await p.$queryRawUnsafe(`
    SELECT fabricante, SUM(count_total) AS total 
    FROM eci.mv_sos_daily_fab 
    WHERE pais = 'MX' 
    GROUP BY fabricante 
    ORDER BY total DESC LIMIT 5
  `)
  console.log('\n=== MX fabricantes in MV (top 5) ===')
  console.table(mx)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
