const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const tables = await p.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='eci' ORDER BY table_name")
  console.log("Tables:", tables.map(x => x.table_name).join(', '))

  // Check Abbott variants in mv_sos_product_latest
  const abbott = await p.$queryRawUnsafe("SELECT DISTINCT fabricante FROM eci.mv_sos_product_latest WHERE fabricante ILIKE '%abbot%' ORDER BY fabricante")
  console.log("\nAbbott variants in mv_sos_product_latest:", abbott.map(x => x.fabricante))

  // Total price=0 count
  const total = await p.$queryRawUnsafe("SELECT COUNT(*)::int as cnt FROM eci.mv_sos_product_latest WHERE precio_venta = 0")
  console.log("\nTotal price=0 rows:", total[0].cnt)

  // Sample a BENAVIDES price=0 row - check all columns
  const sample = await p.$queryRawUnsafe("SELECT * FROM eci.mv_sos_product_latest WHERE precio_venta = 0 AND retail = 'BENAVIDES' LIMIT 3")
  console.log("\nSample BENAVIDES price=0 (all cols):")
  for (const row of sample) {
    const clean = {}
    for (const [k, v] of Object.entries(row)) {
      clean[k] = typeof v === 'bigint' ? Number(v) : v
    }
    console.log(clean)
  }

  // Sample a CRUZ VERDE price=0 row
  const cv = await p.$queryRawUnsafe("SELECT * FROM eci.mv_sos_product_latest WHERE precio_venta = 0 AND retail = 'CRUZ VERDE' LIMIT 3")
  console.log("\nSample CRUZ VERDE price=0 (all cols):")
  for (const row of cv) {
    const clean = {}
    for (const [k, v] of Object.entries(row)) {
      clean[k] = typeof v === 'bigint' ? Number(v) : v
    }
    console.log(clean)
  }

  await p.$disconnect()
}
main()
