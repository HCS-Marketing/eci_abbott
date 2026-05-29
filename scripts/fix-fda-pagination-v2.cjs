const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const PAGE_SIZE = 54

async function main() {
  console.log('=== Fixing FARMACIA DEL AHORRO pagination ===')
  console.log('Strategy: Use ROW_NUMBER per (fecha, categoria) ordered by (orden, id)')
  console.log('New page = ceil(row_number / 54)\n')

  // Set statement timeout to 5 minutes
  await p.$queryRawUnsafe(`SET statement_timeout = '300000'`)

  // First, test on a single day to verify it works
  console.log('Testing on 2026-05-27...')
  const t0 = Date.now()
  await p.$queryRawUnsafe(`
    UPDATE eci.sos s
    SET pagina = sub.new_pagina
    FROM (
      SELECT ctid AS rid,
        CEIL(ROW_NUMBER() OVER (
          PARTITION BY categoria
          ORDER BY orden ASC, id ASC
        )::numeric / ${PAGE_SIZE})::int AS new_pagina
      FROM eci.sos
      WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX' AND fecha::date = '2026-05-27'::date
    ) sub
    WHERE s.ctid = sub.rid
  `)
  console.log(`  Done in ${((Date.now()-t0)/1000).toFixed(1)}s`)

  // Verify
  const check = await p.$queryRawUnsafe(`
    SELECT pagina, COUNT(*) AS cnt
    FROM eci.sos
    WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND fecha::date = '2026-05-27' AND categoria = 'Fórmula Láctea'
    GROUP BY pagina ORDER BY pagina LIMIT 5
  `)
  console.log('Verification (first 5 pages):')
  console.table(check)

  if (Number(check[0]?.cnt) > PAGE_SIZE + 5) {
    console.log('ERROR: Page 1 still has too many products. Aborting.')
    await p.$disconnect()
    return
  }

  // Now process all remaining days
  const dates = await p.$queryRawUnsafe(`
    SELECT DISTINCT fecha::date AS d
    FROM eci.sos
    WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX' AND fecha::date != '2026-05-27'::date
    ORDER BY d
  `)
  console.log(`\nProcessing remaining ${dates.length} days...`)

  let done = 0
  for (const { d } of dates) {
    const ds = d.toISOString().split('T')[0]
    await p.$queryRawUnsafe(`
      UPDATE eci.sos s
      SET pagina = sub.new_pagina
      FROM (
        SELECT ctid AS rid,
          CEIL(ROW_NUMBER() OVER (
            PARTITION BY categoria
            ORDER BY orden ASC, id ASC
          )::numeric / ${PAGE_SIZE})::int AS new_pagina
        FROM eci.sos
        WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX' AND fecha::date = '${ds}'::date
      ) sub
      WHERE s.ctid = sub.rid
    `)
    done++
    if (done % 10 === 0) {
      console.log(`  ${done}/${dates.length} (${ds})`)
    }
  }
  console.log(`  ${done}/${dates.length} - ALL DONE`)

  // Final verification
  console.log('\n=== Final verification ===')
  const final = await p.$queryRawUnsafe(`
    SELECT categoria, ROUND(AVG(cnt)) AS avg_p1, MAX(cnt) AS max_p1
    FROM (
      SELECT categoria, fecha::date AS d, COUNT(*) AS cnt
      FROM eci.sos
      WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND pagina = 1
      GROUP BY categoria, fecha::date
    ) sub
    GROUP BY categoria
  `)
  console.table(final)

  // Now refresh the materialized views
  console.log('\nRefreshing materialized views...')
  await p.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW eci.mv_sos_daily_fab`)
  console.log('  mv_sos_daily_fab refreshed')
  await p.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW eci.mv_sos_daily_marca`)
  console.log('  mv_sos_daily_marca refreshed')
  await p.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW eci.mv_sos_daily_titulo`)
  console.log('  mv_sos_daily_titulo refreshed')
  await p.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW eci.mv_sos_dimensions`)
  console.log('  mv_sos_dimensions refreshed')
  await p.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW eci.mv_sos_product_latest`)
  console.log('  mv_sos_product_latest refreshed')

  await p.$disconnect()
  console.log('\nAll done!')
}
main().catch(e => { console.error(e); process.exit(1) })
