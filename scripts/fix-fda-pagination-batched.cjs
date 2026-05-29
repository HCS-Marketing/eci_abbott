const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const PAGE_SIZE = 54

async function main() {
  console.log('=== Fixing FARMACIA DEL AHORRO pagination (page size = 54) ===')
  console.log('Processing by day to avoid timeout...\n')

  // Get all distinct dates for FDA MX
  const dates = await p.$queryRawUnsafe(`
    SELECT DISTINCT fecha::date AS d
    FROM eci.sos
    WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX'
    ORDER BY d
  `)
  console.log(`Total days to process: ${dates.length}`)

  let processed = 0
  for (const { d } of dates) {
    const dateStr = d.toISOString().split('T')[0]
    
    // Re-paginate this day: row_number by (categoria, orden, id) → new page = ceil(rn/54)
    await p.$queryRawUnsafe(`
      UPDATE eci.sos s
      SET pagina = sub.new_pagina
      FROM (
        SELECT ctid, 
          CEIL(ROW_NUMBER() OVER (
            PARTITION BY categoria
            ORDER BY orden ASC, id ASC
          )::numeric / ${PAGE_SIZE})::int AS new_pagina
        FROM eci.sos
        WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX' AND fecha::date = '${dateStr}'::date
      ) sub
      WHERE s.ctid = sub.ctid
    `)
    
    processed++
    if (processed % 20 === 0 || processed === dates.length) {
      console.log(`  Processed ${processed}/${dates.length} days (${dateStr})`)
    }
  }

  console.log('\n=== Verification ===')
  
  // Check page 1 counts after fix
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

  // Sample day verification
  console.log('\nPage distribution for 2026-05-27 Formula Lactea:')
  const pages = await p.$queryRawUnsafe(`
    SELECT pagina, COUNT(*) AS cnt
    FROM eci.sos
    WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND fecha::date = '2026-05-27' AND categoria = 'Fórmula Láctea'
    GROUP BY pagina ORDER BY pagina
    LIMIT 5
  `)
  console.table(pages)

  await p.$disconnect()
  console.log('\nDone!')
}
main().catch(e => { console.error(e); process.exit(1) })
