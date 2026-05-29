const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const PAGE_SIZE = 54

async function main() {
  // Check sample data with correct columns
  console.log('=== Sample FDA rows (MX, 2026-05-27, Formula Lactea) ===')
  const sample = await p.$queryRawUnsafe(`
    SELECT id, pagina, orden, ranking, titulo
    FROM eci.sos
    WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND fecha::date = '2026-05-27' AND categoria = 'Fórmula Láctea'
    ORDER BY pagina, orden, ranking
    LIMIT 20
  `)
  console.table(sample)

  // Check what "orden" looks like - is it unique per day/retail/category?
  console.log('\n=== Orden range for FDA Formula Lactea on 2026-05-27 ===')
  const range = await p.$queryRawUnsafe(`
    SELECT MIN(orden) AS min_orden, MAX(orden) AS max_orden, COUNT(*) AS cnt,
           MIN(ranking) AS min_ranking, MAX(ranking) AS max_ranking
    FROM eci.sos
    WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND fecha::date = '2026-05-27' AND categoria = 'Fórmula Láctea'
  `)
  console.table(range)

  // Check current page distribution
  console.log('\n=== Current page distribution for FDA Formula Lactea on 2026-05-27 ===')
  const pages = await p.$queryRawUnsafe(`
    SELECT pagina, COUNT(*) AS cnt, MIN(orden) AS min_orden, MAX(orden) AS max_orden
    FROM eci.sos
    WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND fecha::date = '2026-05-27' AND categoria = 'Fórmula Láctea'
    GROUP BY pagina ORDER BY pagina
  `)
  console.table(pages)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
