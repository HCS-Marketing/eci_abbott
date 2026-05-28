const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Check duplicates using id as the product identifier
  // A product (id) should appear once per (fecha, retail, categoria) at most
  
  console.log('=== DUPLICATE CHECK using id as product key ===\n')
  
  // Key: (fecha, retail, id, categoria) - same product in same category on same day
  console.log('--- Key: (fecha, retail, id, categoria) ---')
  const dupes1 = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as dup_groups, SUM(cnt - 1) as extra_rows FROM (
      SELECT fecha, retail, id, categoria, COUNT(*) as cnt
      FROM eci.sos
      WHERE id IS NOT NULL AND id != ''
      GROUP BY fecha, retail, id, categoria
      HAVING COUNT(*) > 1
    ) sub
  `)
  console.log('Duplicate groups:', Number(dupes1[0].dup_groups), '| Extra rows:', Number(dupes1[0].extra_rows))

  // Sample: are these truly identical?
  console.log('\n--- Sample duplicates by (fecha, retail, id, categoria) ---')
  const sample1 = await p.$queryRawUnsafe(`
    SELECT fecha, retail, id, categoria, COUNT(*) as cnt
    FROM eci.sos
    WHERE id IS NOT NULL AND id != ''
    GROUP BY fecha, retail, id, categoria
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 5
  `)
  console.table(sample1.map(r => ({
    fecha: r.fecha, retail: r.retail, id: (r.id||'').substring(0, 30),
    cat: (r.categoria||'').substring(0, 40), cnt: Number(r.cnt)
  })))

  // For the top one, show the actual rows
  if (sample1.length > 0) {
    const s = sample1[0]
    console.log('\nDetail for top duplicate:')
    const detail = await p.$queryRawUnsafe(`
      SELECT titulo, marca, fabricante, precio_venta, pagina, orden, ranking
      FROM eci.sos
      WHERE fecha = $1 AND retail = $2 AND id = $3 AND categoria = $4
      ORDER BY pagina, orden
    `, s.fecha, s.retail, s.id, s.categoria)
    console.table(detail.map(r => ({
      titulo: (r.titulo||'').substring(0, 50), marca: r.marca, fab: r.fabricante,
      precio: r.precio_venta ? Number(r.precio_venta) : null,
      pagina: Number(r.pagina), orden: Number(r.orden), ranking: r.ranking ? Number(r.ranking) : null
    })))
  }

  // Check: what about rows with NULL or empty id?
  console.log('\n--- Rows with NULL/empty id ---')
  const nullId = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt FROM eci.sos WHERE id IS NULL OR id = ''
  `)
  console.log('Rows with NULL/empty id:', Number(nullId[0].cnt))

  // Tighter key: (fecha, retail, id, categoria, pagina, orden)
  console.log('\n--- Key: (fecha, retail, id, categoria, pagina, orden) ---')
  const dupes2 = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as dup_groups, SUM(cnt - 1) as extra_rows FROM (
      SELECT fecha, retail, id, categoria, pagina, orden, COUNT(*) as cnt
      FROM eci.sos
      WHERE id IS NOT NULL AND id != ''
      GROUP BY fecha, retail, id, categoria, pagina, orden
      HAVING COUNT(*) > 1
    ) sub
  `)
  console.log('Duplicate groups:', Number(dupes2[0].dup_groups), '| Extra rows:', Number(dupes2[0].extra_rows))

  // Are those fully identical?
  console.log('\n--- Of those, how many are FULLY identical? ---')
  const identity = await p.$queryRawUnsafe(`
    WITH dup_keys AS (
      SELECT fecha, retail, id, categoria, pagina, orden, COUNT(*) as key_cnt
      FROM eci.sos
      WHERE id IS NOT NULL AND id != ''
      GROUP BY fecha, retail, id, categoria, pagina, orden
      HAVING COUNT(*) > 1
    ),
    full_dedup AS (
      SELECT fecha, retail, id, categoria, pagina, orden, titulo, marca, fabricante, precio_venta, COUNT(*) as full_cnt
      FROM eci.sos
      WHERE id IS NOT NULL AND id != ''
      GROUP BY fecha, retail, id, categoria, pagina, orden, titulo, marca, fabricante, precio_venta
      HAVING COUNT(*) > 1
    )
    SELECT 
      (SELECT SUM(key_cnt - 1) FROM dup_keys) as extra_by_key,
      (SELECT SUM(full_cnt - 1) FROM full_dedup) as extra_fully_identical
  `)
  const r = identity[0]
  console.log('Extra rows by key:', Number(r.extra_by_key))
  console.log('Extra rows FULLY identical:', Number(r.extra_fully_identical))
  console.log('Same key but different data:', Number(r.extra_by_key) - Number(r.extra_fully_identical))

  // Distribution by retail
  console.log('\n--- Duplicates by retail (key: fecha+retail+id+cat+pag+ord) ---')
  const byRetail = await p.$queryRawUnsafe(`
    SELECT retail, pais, SUM(cnt - 1) as extra_rows FROM (
      SELECT fecha, retail, pais, id, categoria, pagina, orden, COUNT(*) as cnt
      FROM eci.sos
      WHERE id IS NOT NULL AND id != ''
      GROUP BY fecha, retail, pais, id, categoria, pagina, orden
      HAVING COUNT(*) > 1
    ) sub
    GROUP BY retail, pais
    ORDER BY extra_rows DESC
  `)
  console.table(byRetail.map(r => ({ retail: r.retail, pais: r.pais, extra_rows: Number(r.extra_rows) })))
}

main().catch(console.error).finally(() => p.$disconnect())
