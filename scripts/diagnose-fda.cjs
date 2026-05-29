const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Check for active locks/transactions
  console.log('=== Active queries on the database ===')
  const active = await p.$queryRawUnsafe(`
    SELECT pid, state, query_start::text, 
      EXTRACT(EPOCH FROM NOW() - query_start)::int AS duration_s,
      LEFT(query, 100) AS query_preview
    FROM pg_stat_activity
    WHERE datname = current_database() AND state != 'idle'
    ORDER BY query_start
  `)
  console.table(active)

  // Check if 2026-05-27 was already fixed (from v2)
  console.log('\n=== Check 2026-05-27 page distribution ===')
  const day27 = await p.$queryRawUnsafe(`
    SELECT pagina, COUNT(*) AS cnt
    FROM eci.sos
    WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND fecha::date = '2026-05-27' AND categoria = 'Fórmula Láctea'
    GROUP BY pagina ORDER BY pagina LIMIT 5
  `)
  console.table(day27)

  // Check if 2026-05-26 is still unfixed
  console.log('\n=== Check 2026-05-26 page distribution ===')
  const day26 = await p.$queryRawUnsafe(`
    SELECT pagina, COUNT(*) AS cnt
    FROM eci.sos
    WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND fecha::date = '2026-05-26' AND categoria = 'Fórmula Láctea'
    GROUP BY pagina ORDER BY pagina LIMIT 5
  `)
  console.table(day26)

  // Try a simple single-day UPDATE with timing
  console.log('\n=== Attempting single-day UPDATE on 2026-05-26 ===')
  const t0 = Date.now()
  const result = await p.$executeRawUnsafe(`
    UPDATE eci.sos s
    SET pagina = sub.new_pagina
    FROM (
      SELECT id, fecha, categoria,
        CEIL(ROW_NUMBER() OVER (
          PARTITION BY categoria
          ORDER BY orden ASC, id ASC
        )::numeric / 54)::int AS new_pagina
      FROM eci.sos
      WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX' 
        AND fecha >= '2026-05-26'::date AND fecha < '2026-05-27'::date
    ) sub
    WHERE s.id = sub.id AND s.fecha = sub.fecha AND s.categoria = sub.categoria
      AND s.retail = 'FARMACIA DEL AHORRO' AND s.pais = 'MX'
  `)
  console.log(`  Done in ${((Date.now()-t0)/1000).toFixed(1)}s, rows affected: ${result}`)

  // Verify
  console.log('\n=== Check 2026-05-26 AFTER fix ===')
  const after = await p.$queryRawUnsafe(`
    SELECT pagina, COUNT(*) AS cnt
    FROM eci.sos
    WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND fecha::date = '2026-05-26' AND categoria = 'Fórmula Láctea'
    GROUP BY pagina ORDER BY pagina LIMIT 5
  `)
  console.table(after)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
