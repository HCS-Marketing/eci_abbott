// Diagnose: marca → fabricante mapping in eci.sos
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

async function main() {
  // 1. How many rows have NULL/empty fabricante vs. real values?
  const nullStats = await p.$queryRawUnsafe(`
    SELECT
      COUNT(*) FILTER (WHERE fabricante IS NULL OR fabricante = '')::int AS null_fab,
      COUNT(*) FILTER (WHERE fabricante IS NOT NULL AND fabricante != '')::int AS has_fab,
      COUNT(*)::int AS total
    FROM eci.sos
  `)
  console.log("\n=== fabricante NULL stats ===")
  console.table(nullStats)

  // 2. All distinct marca → fabricante pairs (sorted by count)
  const rows = await p.$queryRawUnsafe(`
    SELECT
      COALESCE(fabricante, 'NULL') AS fabricante,
      marca,
      COUNT(*)::int AS cnt
    FROM eci.sos
    GROUP BY fabricante, marca
    ORDER BY cnt DESC
    LIMIT 100
  `)
  console.log("\n=== marca → fabricante (top 100 by count) ===")
  rows.forEach(r =>
    console.log(
      String(r.cnt).padStart(8),
      String(r.fabricante).padEnd(32),
      r.marca
    )
  )

  // 3. Check mv_search_daily_fab if it exists
  try {
    const mv = await p.$queryRawUnsafe(`
      SELECT fabricante, SUM(count_p1)::int AS total_p1
      FROM eci.mv_search_daily_fab
      GROUP BY fabricante
      ORDER BY total_p1 DESC
      LIMIT 30
    `)
    console.log("\n=== mv_search_daily_fab fabricante totals ===")
    mv.forEach(r => console.log(String(r.total_p1).padStart(8), r.fabricante))
  } catch (e) {
    console.log("\n mv_search_daily_fab not found:", e.message)
  }

  await p.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
