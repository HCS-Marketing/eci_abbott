const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  // 1. How many distinct categories per retail in MX?
  console.log('=== Categories per retail (MX) ===')
  const cats = await p.$queryRawUnsafe(`
    SELECT retail, COUNT(DISTINCT categoria) AS num_categories
    FROM eci.sos WHERE pais = 'MX'
    GROUP BY retail ORDER BY num_categories DESC
  `)
  console.table(cats)

  // 2. How many distinct dates per retail?
  console.log('\n=== Distinct dates per retail (MX) ===')
  const dates = await p.$queryRawUnsafe(`
    SELECT retail, COUNT(DISTINCT fecha::date) AS num_days
    FROM eci.sos WHERE pais = 'MX'
    GROUP BY retail ORDER BY num_days DESC
  `)
  console.table(dates)

  // 3. Average products per page / total products per retail on a single day
  console.log('\n=== Products on page 1 per retail on 2026-05-27 ===')
  const prods = await p.$queryRawUnsafe(`
    SELECT retail, categoria, COUNT(*) AS products_p1
    FROM eci.sos
    WHERE pais = 'MX' AND fecha::date = '2026-05-27' AND pagina = 1
    GROUP BY retail, categoria ORDER BY retail, products_p1 DESC
  `)
  console.table(prods)

  // 4. Total rows per retail (all pages)
  console.log('\n=== Total rows per retail on 2026-05-27 (all pages) ===')
  const total = await p.$queryRawUnsafe(`
    SELECT retail, COUNT(*) AS total_rows, COUNT(*) FILTER (WHERE pagina = 1) AS p1_rows, MAX(pagina) AS max_page
    FROM eci.sos
    WHERE pais = 'MX' AND fecha::date = '2026-05-27'
    GROUP BY retail ORDER BY total_rows DESC
  `)
  console.table(total)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
