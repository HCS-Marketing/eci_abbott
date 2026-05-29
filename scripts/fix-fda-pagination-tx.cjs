const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const PAGE_SIZE = 54

async function main() {
  console.log('=== Fixing FARMACIA DEL AHORRO pagination (page size = 54) ===')
  console.log('Using interactive transaction with 5min timeout\n')

  // Use interactive transaction with extended timeout
  await p.$transaction(async (tx) => {
    // Get all distinct dates (excluding already-fixed 2026-05-27)
    const dates = await tx.$queryRawUnsafe(`
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
      
      await tx.$executeRawUnsafe(`
        UPDATE eci.sos s
        SET pagina = sub.new_pagina
        FROM (
          SELECT id, fecha, categoria,
            CEIL(ROW_NUMBER() OVER (
              PARTITION BY categoria
              ORDER BY orden ASC, id ASC
            )::numeric / ${PAGE_SIZE})::int AS new_pagina
          FROM eci.sos
          WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX' AND fecha >= '${ds}'::date AND fecha < ('${ds}'::date + interval '1 day')
        ) sub
        WHERE s.id = sub.id AND s.fecha = sub.fecha AND s.categoria = sub.categoria
          AND s.retail = 'FARMACIA DEL AHORRO' AND s.pais = 'MX'
      `)
      
      done++
      if (done % 10 === 0 || done === 1) {
        const elapsed = ((Date.now()-t0)/1000).toFixed(0)
        const rate = done / ((Date.now()-t0)/1000)
        const eta = rate > 0 ? ((dates.length - done) / rate).toFixed(0) : '?'
        console.log(`  ${done}/${dates.length} (${ds}) [${elapsed}s, ~${eta}s left]`)
      }
    }
    console.log(`  COMPLETE: ${done}/${dates.length} in ${((Date.now()-t0)/1000).toFixed(0)}s`)
  }, {
    maxWait: 10000,
    timeout: 600000 // 10 minutes
  })

  // Verify outside transaction
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
  let t = Date.now()
  await p.$executeRawUnsafe('REFRESH MATERIALIZED VIEW eci.mv_sos_daily_fab')
  console.log(`  mv_sos_daily_fab (${((Date.now()-t)/1000).toFixed(1)}s)`)
  t = Date.now()
  await p.$executeRawUnsafe('REFRESH MATERIALIZED VIEW eci.mv_sos_daily_marca')
  console.log(`  mv_sos_daily_marca (${((Date.now()-t)/1000).toFixed(1)}s)`)
  t = Date.now()
  await p.$executeRawUnsafe('REFRESH MATERIALIZED VIEW eci.mv_sos_daily_titulo')
  console.log(`  mv_sos_daily_titulo (${((Date.now()-t)/1000).toFixed(1)}s)`)
  t = Date.now()
  await p.$executeRawUnsafe('REFRESH MATERIALIZED VIEW eci.mv_sos_dimensions')
  console.log(`  mv_sos_dimensions (${((Date.now()-t)/1000).toFixed(1)}s)`)
  t = Date.now()
  await p.$executeRawUnsafe('REFRESH MATERIALIZED VIEW eci.mv_sos_product_latest')
  console.log(`  mv_sos_product_latest (${((Date.now()-t)/1000).toFixed(1)}s)`)

  // Final SOS
  console.log('\n=== New MX SOS per retail ===')
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
