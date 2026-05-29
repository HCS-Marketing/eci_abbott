const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

async function main() {
  // All distinct search terms
  const terms = await p.$queryRawUnsafe(
    "SELECT DISTINCT search FROM eci.search WHERE search IS NOT NULL AND search != '' ORDER BY search"
  )
  console.log("Total distinct search terms:", terms.length)
  console.log(terms.map(x => x.search))

  // Distinct retails
  const retails = await p.$queryRawUnsafe(
    "SELECT DISTINCT retail FROM eci.search ORDER BY retail"
  )
  console.log("\nRetails:", retails.map(x => x.retail))

  // Distinct countries
  const countries = await p.$queryRawUnsafe(
    "SELECT DISTINCT pais FROM eci.search ORDER BY pais"
  )
  console.log("\nCountries:", countries.map(x => x.pais))

  // Date range
  const dates = await p.$queryRawUnsafe(
    "SELECT MIN(fecha) as mn, MAX(fecha) as mx FROM eci.search"
  )
  console.log("\nDate range:", dates[0])

  // Check for materialized views
  const mvs = await p.$queryRawUnsafe(`
    SELECT matviewname FROM pg_matviews WHERE schemaname = 'eci' AND matviewname ILIKE '%search%'
  `)
  console.log("\nMaterialized views:", mvs)

  // Check indexes on search table
  const idx = await p.$queryRawUnsafe(`
    SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'eci' AND tablename = 'search'
  `)
  console.log("\nIndexes:", idx.map(i => i.indexname))

  await p.$disconnect()
}
main()
