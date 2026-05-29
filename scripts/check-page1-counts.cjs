const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  // Check all retailers across all countries: avg and max page 1 products per day/category
  console.log('=== Avg/Max page 1 products per (day, retail, category) ===')
  const stats = await p.$queryRawUnsafe(`
    SELECT pais, retail, categoria,
      ROUND(AVG(cnt)) AS avg_p1_products,
      MAX(cnt) AS max_p1_products,
      COUNT(*) AS num_day_combos
    FROM (
      SELECT pais, retail, categoria, fecha::date AS d, COUNT(*) AS cnt
      FROM eci.sos
      WHERE pagina = 1
      GROUP BY pais, retail, categoria, fecha::date
    ) sub
    GROUP BY pais, retail, categoria
    ORDER BY max_p1_products DESC
  `)
  console.table(stats)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
