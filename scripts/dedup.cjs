const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Check if table has an id column
  console.log('=== Table columns ===')
  const cols = await p.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'eci' AND table_name = 'sos'
    ORDER BY ordinal_position
  `)
  console.log(cols.map(c => `${c.column_name} (${c.data_type})`).join(', '))

  // Deduplicate using ctid (PostgreSQL physical row ID)
  // Keep one row per (fecha, retail, skuid, categoria, pagina, orden), delete extras
  console.log('\n=== DEDUPLICATING... ===')
  console.log('This may take a while...')
  
  const result = await p.$queryRawUnsafe(`
    DELETE FROM eci.sos
    WHERE ctid NOT IN (
      SELECT MIN(ctid)
      FROM eci.sos
      GROUP BY fecha, retail, pais, skuid, categoria, pagina, orden
    )
  `)
  console.log('Done! Deleted duplicate rows.')

  // Verify
  console.log('\n=== POST-DEDUP COUNTS ===')
  const total = await p.$queryRawUnsafe('SELECT COUNT(*) as n FROM eci.sos')
  console.log('Total rows after dedup:', Number(total[0].n))

  // Verify no more duplicates
  const check = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as dup_groups FROM (
      SELECT fecha, retail, pais, skuid, categoria, pagina, orden, COUNT(*) as cnt
      FROM eci.sos
      GROUP BY fecha, retail, pais, skuid, categoria, pagina, orden
      HAVING COUNT(*) > 1
    ) sub
  `)
  console.log('Remaining duplicate groups:', Number(check[0].dup_groups))

  // Re-verify SOS for 2026-05-27
  console.log('\n=== POST-DEDUP SOS VERIFICATION (2026-05-27, page 1) ===')
  const sos = await p.$queryRawUnsafe(`
    SELECT retail, pais,
           COUNT(*) as total_p1,
           SUM(CASE WHEN fabricante = 'ABBOTT' THEN 1 ELSE 0 END) as abbott_p1,
           ROUND(100.0 * SUM(CASE WHEN fabricante = 'ABBOTT' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as sos_pct
    FROM eci.sos
    WHERE pagina = 1 AND fecha = '2026-05-27'
    GROUP BY retail, pais
    ORDER BY retail
  `)
  console.table(sos.map(r => ({
    retail: r.retail, pais: r.pais,
    total_p1: Number(r.total_p1), abbott_p1: Number(r.abbott_p1),
    sos: Number(r.sos_pct) + '%'
  })))
}

main().catch(console.error).finally(() => p.$disconnect())
