const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const cols = await p.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema = 'eci' AND table_name = 'sos'
    ORDER BY ordinal_position
  `)
  console.log('Columns:', cols.map(c => c.column_name).join(', '))

  // Sample one of those "duplicate" groups to see if rows are truly identical
  console.log('\n=== SAMPLE: FARMACIA DEL AHORRO, page 1, orden 1, "Fórmula Láctea" ===')
  const sample = await p.$queryRawUnsafe(`
    SELECT titulo, marca, fabricante, precio_venta, skuid, ranking
    FROM eci.sos
    WHERE retail = 'FARMACIA DEL AHORRO' 
      AND fecha = '2025-12-15' 
      AND categoria LIKE '%rmula L%ctea%'
      AND pagina = 1 AND orden = 1
    LIMIT 10
  `)
  console.table(sample.map(r => ({
    titulo: (r.titulo || '').substring(0, 60),
    marca: r.marca,
    fab: r.fabricante,
    precio_venta: r.precio_venta ? Number(r.precio_venta) : null,
    skuid: r.skuid || '(empty)',
    ranking: r.ranking ? Number(r.ranking) : null
  })))

  // Check distinct titles for the same key
  console.log('\n=== DISTINCT titulos for same key ===')
  const distinctT = await p.$queryRawUnsafe(`
    SELECT DISTINCT titulo FROM eci.sos
    WHERE retail = 'FARMACIA DEL AHORRO' 
      AND fecha = '2025-12-15' 
      AND categoria LIKE '%rmula L%ctea%'
      AND pagina = 1 AND orden = 1
  `)
  console.log(`Distinct titles: ${distinctT.length}`)
  distinctT.forEach(r => console.log(' -', (r.titulo || '').substring(0, 80)))

  // Critical: are these truly the same product repeated, or different products at same position?
  console.log('\n=== KEY QUESTION: Fully identical rows vs same-key-different-data ===')
  const identity = await p.$queryRawUnsafe(`
    WITH dup_keys AS (
      SELECT fecha, retail, pais, COALESCE(skuid,'') as sk, categoria, pagina, orden, COUNT(*) as key_cnt
      FROM eci.sos
      GROUP BY fecha, retail, pais, COALESCE(skuid,''), categoria, pagina, orden
      HAVING COUNT(*) > 1
    ),
    full_dedup AS (
      SELECT fecha, retail, pais, COALESCE(skuid,'') as sk, categoria, pagina, orden, 
             titulo, marca, fabricante, precio_venta, COUNT(*) as full_cnt
      FROM eci.sos
      GROUP BY fecha, retail, pais, COALESCE(skuid,''), categoria, pagina, orden, titulo, marca, fabricante, precio_venta
      HAVING COUNT(*) > 1
    )
    SELECT 
      (SELECT COUNT(*) FROM dup_keys) as groups_by_key,
      (SELECT SUM(key_cnt - 1) FROM dup_keys) as extra_by_key,
      (SELECT COUNT(*) FROM full_dedup) as groups_fully_identical,
      (SELECT SUM(full_cnt - 1) FROM full_dedup) as extra_fully_identical
  `)
  const r = identity[0]
  console.log('Groups with same key:', Number(r.groups_by_key))
  console.log('Extra rows by key alone:', Number(r.extra_by_key))
  console.log('Groups that are FULLY identical (including titulo+marca+precio):', Number(r.groups_fully_identical))
  console.log('Extra rows that are TRULY identical:', Number(r.extra_fully_identical))
  console.log('')
  const trueExtra = Number(r.extra_fully_identical)
  const keyExtra = Number(r.extra_by_key)
  console.log(`=> ${trueExtra} are TRUE duplicates (safe to remove)`)
  console.log(`=> ${keyExtra - trueExtra} share key but differ in product data (NOT safe to remove)`)
}

main().catch(console.error).finally(() => p.$disconnect())
