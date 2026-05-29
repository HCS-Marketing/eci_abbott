const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const PAGE_SIZE = 54

async function main() {
  console.log('=== Fixing FARMACIA DEL AHORRO pagination (page size = 54) ===')
  
  // Count affected rows first
  const countResult = await p.$queryRawUnsafe(`
    SELECT COUNT(*) AS cnt FROM eci.sos
    WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX'
  `)
  console.log(`Total FDA MX rows: ${countResult[0].cnt}`)

  // Re-paginate: assign new pagina = ceil(row_number / 54)
  // row_number ordered by (orden ASC, id ASC) within each (fecha, categoria) group
  console.log('Updating pagina column...')
  
  const result = await p.$queryRawUnsafe(`
    UPDATE eci.sos s
    SET pagina = sub.new_pagina
    FROM (
      SELECT id, fecha, 
        CEIL(ROW_NUMBER() OVER (
          PARTITION BY fecha::date, categoria 
          ORDER BY orden ASC, id ASC
        )::numeric / ${PAGE_SIZE}) AS new_pagina
      FROM eci.sos
      WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX'
    ) sub
    WHERE s.id = sub.id AND s.fecha = sub.fecha AND s.retail = 'FARMACIA DEL AHORRO' AND s.pais = 'MX'
  `)
  console.log('Update complete:', result)

  // Verify the fix
  console.log('\n=== Verification: FDA Formula Lactea on 2026-05-27 after fix ===')
  const verify = await p.$queryRawUnsafe(`
    SELECT pagina, COUNT(*) AS cnt, MIN(orden) AS min_orden, MAX(orden) AS max_orden
    FROM eci.sos
    WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND fecha::date = '2026-05-27' AND categoria = 'Fórmula Láctea'
    GROUP BY pagina ORDER BY pagina
    LIMIT 10
  `)
  console.table(verify)

  // Check new page 1 count across all dates
  console.log('\n=== Avg/Max page 1 products per day for FDA after fix ===')
  const stats = await p.$queryRawUnsafe(`
    SELECT categoria, ROUND(AVG(cnt)) AS avg_p1, MAX(cnt) AS max_p1
    FROM (
      SELECT categoria, fecha::date AS d, COUNT(*) AS cnt
      FROM eci.sos
      WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND pagina = 1
      GROUP BY categoria, fecha::date
    ) sub
    GROUP BY categoria
  `)
  console.table(stats)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
