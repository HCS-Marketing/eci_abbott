const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Fix MV5: en_stock is boolean, use BOOL_OR instead of MAX
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
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END AS fabricante,
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
      BOOL_OR(en_stock::boolean) AS en_stock
    FROM eci.sos
    WHERE id IS NOT NULL AND precio_venta IS NOT NULL
    GROUP BY fecha::date, retail, pais, categoria, id,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END
  `)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_product_fecha ON eci.mv_sos_product_latest (fecha)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_product_composite ON eci.mv_sos_product_latest (fecha, retail, pais, categoria)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_product_fab ON eci.mv_sos_product_latest (fabricante)`)
  await p.$queryRawUnsafe(`CREATE INDEX idx_mv_product_id ON eci.mv_sos_product_latest (producto_id)`)
  console.log('  Done!')

  // Verify all view counts
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
