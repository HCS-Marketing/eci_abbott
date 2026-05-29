const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const r = await p.$queryRawUnsafe(`
    SELECT retail,
      SUM(count_p1)::int AS total_p1,
      SUM(CASE WHEN fabricante = 'ABBOTT' THEN count_p1 ELSE 0 END)::int AS abbott_p1,
      ROUND(SUM(CASE WHEN fabricante = 'ABBOTT' THEN count_p1 ELSE 0 END) * 100.0 / NULLIF(SUM(count_p1), 0), 2) AS sos_p1
    FROM eci.mv_sos_daily_fab
    WHERE pais = 'MX' AND fecha >= '2025-07-15'::date AND fecha <= '2026-05-27'::date
    GROUP BY retail ORDER BY sos_p1 DESC
  `)
  console.table(r)
  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
