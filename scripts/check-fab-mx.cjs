const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Check fabricante distribution for MX
  const r = await p.$queryRawUnsafe(`
    SELECT fabricante, COUNT(*) as cnt 
    FROM eci.sos 
    WHERE pais = 'MX' AND fabricante IS NOT NULL 
    GROUP BY fabricante 
    ORDER BY cnt DESC LIMIT 20
  `)
  console.log('=== Non-null fabricante in MX ===')
  console.table(r)

  // Check for CO
  const r2 = await p.$queryRawUnsafe(`
    SELECT fabricante, COUNT(*) as cnt 
    FROM eci.sos 
    WHERE pais = 'CO' AND fabricante IS NOT NULL 
    GROUP BY fabricante 
    ORDER BY cnt DESC LIMIT 20
  `)
  console.log('\n=== Non-null fabricante in CO ===')
  console.table(r2)

  // Check NULL ratio
  const r3 = await p.$queryRawUnsafe(`
    SELECT pais, 
      COUNT(*) as total,
      COUNT(fabricante) as with_fab,
      COUNT(*) - COUNT(fabricante) as null_fab
    FROM eci.sos GROUP BY pais ORDER BY pais
  `)
  console.log('\n=== NULL fabricante ratio by country ===')
  console.table(r3)

  // Check what the MV has
  const r4 = await p.$queryRawUnsafe(`
    SELECT pais, fabricante, SUM(count_total) as total
    FROM eci.mv_sos_daily_fab
    GROUP BY pais, fabricante
    ORDER BY pais, total DESC
    LIMIT 30
  `)
  console.log('\n=== MV data by country ===')
  console.table(r4)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
