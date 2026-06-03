const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

async function main() {
  // Get the definition of all eci materialized views
  const mvs = await p.$queryRawUnsafe(`
    SELECT schemaname, matviewname, definition
    FROM pg_matviews
    WHERE schemaname = 'eci'
    ORDER BY matviewname
  `)
  console.log(`\n=== Materialized views in eci (${mvs.length}) ===`)
  mvs.forEach(mv => {
    console.log(`\n--- ${mv.matviewname} ---`)
    console.log(mv.definition)
  })
  await p.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
