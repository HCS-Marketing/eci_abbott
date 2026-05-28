const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const rows = await p.$queryRawUnsafe(
    "SELECT fabricante, COUNT(*)::text as cnt FROM eci.sos WHERE UPPER(fabricante) LIKE '%ABBOT%' GROUP BY fabricante ORDER BY COUNT(*) DESC"
  )
  console.log('Abbott fabricante variants:')
  rows.forEach(r => console.log(`  "${r.fabricante}" -> ${r.cnt} rows`))
  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
