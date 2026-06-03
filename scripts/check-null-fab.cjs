const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

async function main() {
  // List all tables in eci schema
  const tables = await p.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'eci' ORDER BY table_name"
  )
  console.log("\n=== Tables in schema eci ===")
  tables.forEach(t => console.log(" ", t.table_name))

  // Check for a marca<->fabricante lookup table
  const candidates = ["marca_fabricante", "fabricante_map", "marca_fab", "brand_map"]
  for (const tbl of candidates) {
    try {
      const r = await p.$queryRawUnsafe(`SELECT * FROM eci.${tbl} LIMIT 5`)
      console.log(`\n=== eci.${tbl} (exists!) ===`)
      console.table(r)
    } catch (_) { /* table not found */ }
  }

  // Distinct NULL-fabricante brands — what's not mapped yet
  const nullBrands = await p.$queryRawUnsafe(`
    SELECT marca, COUNT(*)::int AS cnt
    FROM eci.sos
    WHERE fabricante IS NULL OR fabricante = ''
    GROUP BY marca
    ORDER BY cnt DESC
    LIMIT 50
  `)
  console.log("\n=== Brands with NULL fabricante (top 50) ===")
  nullBrands.forEach(r => console.log(String(r.cnt).padStart(8), r.marca))

  await p.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
