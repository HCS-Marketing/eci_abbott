const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // 1. Check SOS from MV for full range
  console.log('=== MV: Full range (2025-07-15 to 2026-05-27) ===')
  const full = await p.$queryRawUnsafe(`
    SELECT fabricante, SUM(count_p1) AS p1, SUM(count_total) AS total
    FROM eci.mv_sos_daily_fab
    WHERE pais = 'MX' AND fecha >= '2025-07-15'::date AND fecha <= '2026-05-27'::date
    GROUP BY fabricante ORDER BY p1 DESC
  `)
  const totalP1 = full.reduce((s, r) => s + Number(r.p1), 0)
  const totalAll = full.reduce((s, r) => s + Number(r.total), 0)
  console.log(`Total p1: ${totalP1}, Total all: ${totalAll}`)
  full.forEach(r => {
    console.log(`  ${r.fabricante}: p1=${r.p1} (${(Number(r.p1)/totalP1*100).toFixed(2)}%), total=${r.total} (${(Number(r.total)/totalAll*100).toFixed(2)}%)`)
  })

  // 2. Check a specific week
  console.log('\n=== MV: One week (2026-05-20 to 2026-05-27) ===')
  const week = await p.$queryRawUnsafe(`
    SELECT fabricante, SUM(count_p1) AS p1, SUM(count_total) AS total
    FROM eci.mv_sos_daily_fab
    WHERE pais = 'MX' AND fecha >= '2026-05-20'::date AND fecha <= '2026-05-27'::date
    GROUP BY fabricante ORDER BY p1 DESC
  `)
  const weekP1 = week.reduce((s, r) => s + Number(r.p1), 0)
  const weekAll = week.reduce((s, r) => s + Number(r.total), 0)
  console.log(`Total p1: ${weekP1}, Total all: ${weekAll}`)
  week.forEach(r => {
    console.log(`  ${r.fabricante}: p1=${r.p1} (${(Number(r.p1)/weekP1*100).toFixed(2)}%), total=${r.total} (${(Number(r.total)/weekAll*100).toFixed(2)}%)`)
  })

  // 3. Verify directly from raw eci.sos table for the same week
  console.log('\n=== RAW eci.sos: One week (2026-05-20 to 2026-05-27) ===')
  const raw = await p.$queryRawUnsafe(`
    SELECT 
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END AS fab,
      COUNT(*) FILTER (WHERE pagina = 1) AS p1,
      COUNT(*) AS total
    FROM eci.sos
    WHERE pais = 'MX' AND fecha::date >= '2026-05-20'::date AND fecha::date <= '2026-05-27'::date
    GROUP BY 1 ORDER BY p1 DESC
  `)
  const rawP1 = raw.reduce((s, r) => s + Number(r.p1), 0)
  const rawAll = raw.reduce((s, r) => s + Number(r.total), 0)
  console.log(`Total p1: ${rawP1}, Total all: ${rawAll}`)
  raw.forEach(r => {
    console.log(`  ${r.fab}: p1=${r.p1} (${(Number(r.p1)/rawP1*100).toFixed(2)}%), total=${r.total} (${(Number(r.total)/rawAll*100).toFixed(2)}%)`)
  })

  // 4. Per-retail breakdown for one day
  console.log('\n=== RAW eci.sos: Single day 2026-05-27 per retail ===')
  const day = await p.$queryRawUnsafe(`
    SELECT retail,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END AS fab,
      COUNT(*) FILTER (WHERE pagina = 1) AS p1,
      COUNT(*) AS total
    FROM eci.sos
    WHERE pais = 'MX' AND fecha::date = '2026-05-27'::date
    GROUP BY retail, fab ORDER BY retail, p1 DESC
  `)
  const byRetail = {}
  day.forEach(r => {
    if (!byRetail[r.retail]) byRetail[r.retail] = { total_p1: 0, total_all: 0, rows: [] }
    byRetail[r.retail].total_p1 += Number(r.p1)
    byRetail[r.retail].total_all += Number(r.total)
    byRetail[r.retail].rows.push(r)
  })
  for (const [retail, data] of Object.entries(byRetail)) {
    console.log(`\n  ${retail} (total_p1=${data.total_p1}, total_all=${data.total_all}):`)
    data.rows.forEach(r => {
      const pctP1 = data.total_p1 > 0 ? (Number(r.p1)/data.total_p1*100).toFixed(2) : '0'
      console.log(`    ${r.fab}: p1=${r.p1} (${pctP1}%), total=${r.total}`)
    })
  }

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
