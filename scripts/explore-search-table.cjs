const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

async function main() {
  // Check what tables exist in eci schema related to search
  const tables = await p.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'eci' AND table_name ILIKE '%search%'
    ORDER BY table_name
  `)
  console.log("Search tables:", tables)

  // Check columns
  if (tables.length > 0) {
    const tbl = tables[0].table_name
    const cols = await p.$queryRawUnsafe(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_schema = 'eci' AND table_name = '${tbl}'
      ORDER BY ordinal_position
    `)
    console.log(`\nColumns of eci.${tbl}:`)
    cols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`))

    // Sample rows
    const sample = await p.$queryRawUnsafe(`SELECT * FROM eci."${tbl}" LIMIT 5`)
    console.log("\nSample rows:")
    sample.forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r).substring(0, 300)))

    // Count
    const cnt = await p.$queryRawUnsafe(`SELECT COUNT(*) as c FROM eci."${tbl}"`)
    console.log("\nTotal rows:", cnt[0].c)

    // Distinct search terms
    const terms = await p.$queryRawUnsafe(`
      SELECT DISTINCT busqueda FROM eci."${tbl}" ORDER BY busqueda LIMIT 30
    `)
    console.log("\nSearch terms:", terms.map(t => t.busqueda))
  }

  // Also check for views
  const views = await p.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.views 
    WHERE table_schema = 'eci' AND table_name ILIKE '%search%'
  `)
  console.log("\nSearch views:", views)

  await p.$disconnect()
}
main()
