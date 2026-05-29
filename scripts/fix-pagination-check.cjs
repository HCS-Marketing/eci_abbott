const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const PAGE_SIZE = 54

async function main() {
  // Fix retailers that have more than 54 products on page 1
  // We'll re-paginate: assign page = ceil(ranking / 54) based on position within each day/retail/category
  // The `ranking` column represents the product position in the original listing

  // First, let's see what columns we have for ordering
  console.log('=== Checking eci.sos column for position/ranking ===')
  const cols = await p.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema = 'eci' AND table_name = 'sos' 
    ORDER BY ordinal_position
  `)
  console.log(cols.map(c => c.column_name).join(', '))

  // Check if there's a ranking or posicion column
  const sample = await p.$queryRawUnsafe(`
    SELECT id, fecha, retail, categoria, pagina, posicion, titulo
    FROM eci.sos
    WHERE pais = 'MX' AND retail = 'FARMACIA DEL AHORRO' AND fecha::date = '2026-05-27' AND categoria = 'Fórmula Láctea'
    ORDER BY pagina, posicion
    LIMIT 10
  `)
  console.log('\nSample rows:')
  console.table(sample)

  // Count how many will be affected
  const affected = await p.$queryRawUnsafe(`
    SELECT pais, retail, COUNT(*) AS rows_to_fix
    FROM eci.sos s
    WHERE EXISTS (
      SELECT 1 FROM (
        SELECT pais, retail, categoria, fecha::date AS d, COUNT(*) AS cnt
        FROM eci.sos WHERE pagina = 1
        GROUP BY pais, retail, categoria, fecha::date
        HAVING COUNT(*) > ${PAGE_SIZE}
      ) big
      WHERE big.pais = s.pais AND big.retail = s.retail AND big.categoria = s.categoria AND big.d = s.fecha::date
    )
    GROUP BY pais, retail
    ORDER BY rows_to_fix DESC
  `)
  console.log('\n=== Rows to fix per retail ===')
  console.table(affected)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
