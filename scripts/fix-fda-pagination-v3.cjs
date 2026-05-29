const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const PAGE_SIZE = 54

async function main() {
  console.log('=== Fixing FARMACIA DEL AHORRO pagination (page size = 54) ===')
  console.log('Using (id, fecha, categoria) as join key\n')

  // Get all distinct dates (excluding 2026-05-27 which is already fixed)
  const dates = await p.$queryRawUnsafe(`
    SELECT DISTINCT fecha::date AS d
    FROM eci.sos
    WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX' AND fecha::date != '2026-05-27'::date
    ORDER BY d
  `)
  console.log(`Days to process: ${dates.length}`)

  let done = 0
  const t0 = Date.now()
  for (const { d } of dates) {
    const ds = d.toISOString().split('T')[0]
    await p.$queryRawUnsafe(`
      UPDATE eci.sos s
      SET pagina = sub.new_pagina
      FROM (
        SELECT id, fecha, categoria,
          CEIL(ROW_NUMBER() OVER (
            PARTITION BY categoria
            ORDER BY orden ASC, id ASC
          )::numeric / ${PAGE_SIZE})::int AS new_pagina
        FROM eci.sos
        WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX' AND fecha::date = '${ds}'::date
      ) sub
      WHERE s.id = sub.id AND s.fecha = sub.fecha AND s.categoria = sub.categoria
        AND s.retail = 'FARMACIA DEL AHORRO' AND s.pais = 'MX'
    `)
    done++
    if (done % 10 === 0) {
      const elapsed = ((Date.now()-t0)/1000).toFixed(0)
      const rate = (done / (Date.now()-t0) * 1000).toFixed(1)
      const eta = ((dates.length - done) / rate).toFixed(0)
      console.log(`  ${done}/${dates.length} (${ds}) [${elapsed}s elapsed, ~${eta}s remaining]`)
    }
  }
  console.log(`  ${done}/${dates.length} - COMPLETE in ${((Date.now()-t0)/1000).toFixed(0)}s`)

  // Verify
  console.log('\n=== Verification ===')
  const verify = await p.$queryRawUnsafe(`
    SELECT categoria, ROUND(AVG(cnt)) AS avg_p1, MAX(cnt) AS max_p1
    FROM (
      SELECT categoria, fecha::date AS d, COUNT(*) AS cnt
      FROM eci.sos
      WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND pagina = 1
      GROUP BY categoria, fecha::date
    ) sub
    GROUP BY categoria
  `)
  console.table(verify)

  // Refresh MVs
  console.log('\nRefreshing materialized views...')
  const mv0 = Date.now()
  await p.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW eci.mv_sos_daily_fab`)
  console.log(`  mv_sos_daily_fab (${((Date.now()-mv0)/1000).toFixed(1)}s)`)
  const mv1 = Date.now()
  await p.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW eci.mv_sos_daily_marca`)
  console.log(`  mv_sos_daily_marca (${((Date.now()-mv1)/1000).toFixed(1)}s)`)
  const mv2 = Date.now()
  await p.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW eci.mv_sos_daily_titulo`)
  console.log(`  mv_sos_daily_titulo (${((Date.now()-mv2)/1000).toFixed(1)}s)`)
  const mv3 = Date.now()
  await p.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW eci.mv_sos_dimensions`)
  console.log(`  mv_sos_dimensions (${((Date.now()-mv3)/1000).toFixed(1)}s)`)
  const mv4 = Date.now()
  await p.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW eci.mv_sos_product_latest`)
  console.log(`  mv_sos_product_latest (${((Date.now()-mv4)/1000).toFixed(1)}s)`)

  // Final SOS check
  console.log('\n=== New SOS for MX ===')
  const sos = await p.$queryRawUnsafe(`
    SELECT retail, SUM(count_p1)::int AS total_p1,
      SUM(CASE WHEN fabricante = 'ABBOTT' THEN count_p1 ELSE 0 END)::int AS abbott_p1,
      ROUND(SUM(CASE WHEN fabricante = 'ABBOTT' THEN count_p1 ELSE 0 END)*100.0/NULLIF(SUM(count_p1),0),2) AS sos
    FROM eci.mv_sos_daily_fab
    WHERE pais = 'MX' AND fecha >= '2025-07-15'::date AND fecha <= '2026-05-27'::date
    GROUP BY retail ORDER BY sos DESC
  `)
  console.table(sos)

  await p.$disconnect()
  console.log('\nDone!')
}
main().catch(e => { console.error(e); process.exit(1) })
