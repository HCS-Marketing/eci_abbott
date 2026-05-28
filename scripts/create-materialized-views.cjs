const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  console.log('=== Creating Materialized Views ===\n')

  // MV1: Daily aggregated SOS by fabricante
  // This is the CORE view - collapses 2.16M rows into ~500K pre-aggregated summaries
  console.log('Creating mv_sos_daily_fab...')
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
    WHERE fabricante IS NOT NULL
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

  // MV2: Daily aggregated by marca (within fabricante)
  console.log('Creating mv_sos_daily_marca...')
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
    WHERE fabricante IS NOT NULL AND marca IS NOT NULL
    GROUP BY fecha::date, retail, pais, categoria,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END,
      marca
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_marca_composite ON eci.mv_sos_daily_marca (fecha, retail, pais, categoria, fabricante)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_marca_fab ON eci.mv_sos_daily_marca (fabricante)`)
  console.log('  Done!')

  // MV3: Daily titulo-level for titulo drill-down
  console.log('Creating mv_sos_daily_titulo...')
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
    WHERE fabricante IS NOT NULL AND titulo IS NOT NULL AND id IS NOT NULL
    GROUP BY fecha::date, retail, pais, categoria,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END,
      id
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_titulo_composite ON eci.mv_sos_daily_titulo (fecha, retail, pais, categoria, fabricante)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_daily_titulo_fab ON eci.mv_sos_daily_titulo (fabricante)`)
  console.log('  Done!')

  // MV4: Dimension metadata (for fast filter dropdowns)
  console.log('Creating mv_sos_dimensions...')
  await p.$queryRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_dimensions CASCADE`)
  await p.$queryRawUnsafe(`
    CREATE MATERIALIZED VIEW eci.mv_sos_dimensions AS
    SELECT
      pais,
      retail,
      categoria,
      MIN(fecha::date) AS min_fecha,
      MAX(fecha::date) AS max_fecha
    FROM eci.sos
    WHERE retail IS NOT NULL AND categoria IS NOT NULL AND pais IS NOT NULL
    GROUP BY pais, retail, categoria
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_dims_retail ON eci.mv_sos_dimensions (retail)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_dims_cat ON eci.mv_sos_dimensions (categoria)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_dims_pais ON eci.mv_sos_dimensions (pais)`)
  console.log('  Done!')

  // MV5: For pricing/bestsellers/ranking (product-level latest snapshot)
  console.log('Creating mv_sos_product_latest...')
  await p.$queryRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_product_latest CASCADE`)
  await p.$queryRawUnsafe(`
    CREATE MATERIALIZED VIEW eci.mv_sos_product_latest AS
    SELECT
      fecha::date AS fecha,
      retail,
      pais,
      categoria,
      id AS producto_id,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END AS fabricante,
      MAX(titulo) AS titulo,
      MAX(marca) AS marca,
      ROUND(AVG(precio_venta::numeric), 0) AS precio_venta,
      ROUND(AVG(precio_neto::numeric), 0) AS precio_neto,
      ROUND(AVG(descuento::numeric), 1) AS descuento,
      MIN(ranking::numeric) AS best_ranking,
      MAX(pagina) AS max_pagina,
      COUNT(*) FILTER (WHERE pagina = 1) AS appearances_p1,
      COUNT(*) AS appearances_total,
      MAX(url_producto) AS url_producto,
      MAX(presentacion) AS presentacion,
      MAX(promocion) AS promocion,
      MAX(en_stock) AS en_stock
    FROM eci.sos
    WHERE id IS NOT NULL AND precio_venta IS NOT NULL
    GROUP BY fecha::date, retail, pais, categoria, id,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'DESCONOCIDO') END
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_product_fecha ON eci.mv_sos_product_latest (fecha)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_product_composite ON eci.mv_sos_product_latest (fecha, retail, pais, categoria)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_product_fab ON eci.mv_sos_product_latest (fabricante)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_product_id ON eci.mv_sos_product_latest (producto_id)`)
  console.log('  Done!')

  // Verify row counts
  console.log('\n=== View Row Counts ===')
  const counts = await p.$queryRawUnsafe(`
    SELECT 'mv_sos_daily_fab' AS view, COUNT(*) AS rows FROM eci.mv_sos_daily_fab
    UNION ALL SELECT 'mv_sos_daily_marca', COUNT(*) FROM eci.mv_sos_daily_marca
    UNION ALL SELECT 'mv_sos_daily_titulo', COUNT(*) FROM eci.mv_sos_daily_titulo
    UNION ALL SELECT 'mv_sos_dimensions', COUNT(*) FROM eci.mv_sos_dimensions
    UNION ALL SELECT 'mv_sos_product_latest', COUNT(*) FROM eci.mv_sos_product_latest
    UNION ALL SELECT 'eci.sos (original)', COUNT(*) FROM eci.sos
  `)
  console.table(counts.map(r => ({ view: r.view, rows: Number(r.rows) })))
}

main().catch(console.error).finally(() => p.$disconnect())
