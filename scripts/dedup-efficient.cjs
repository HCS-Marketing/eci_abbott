const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // More efficient approach: create a deduped temp table, truncate original, reinsert
  console.log('=== EFFICIENT DEDUP: Using temp table approach ===')
  console.log('Step 1: Creating deduplicated temp table...')
  
  await p.$queryRawUnsafe(`
    CREATE TABLE eci.sos_dedup AS
    SELECT DISTINCT ON (fecha, retail, pais, skuid, categoria, pagina, orden)
      *
    FROM eci.sos
    ORDER BY fecha, retail, pais, skuid, categoria, pagina, orden
  `)
  console.log('Step 1 done.')

  console.log('Step 2: Checking counts...')
  const origCount = await p.$queryRawUnsafe('SELECT COUNT(*) as n FROM eci.sos')
  const dedupCount = await p.$queryRawUnsafe('SELECT COUNT(*) as n FROM eci.sos_dedup')
  console.log('  Original:', Number(origCount[0].n))
  console.log('  Deduped:', Number(dedupCount[0].n))
  console.log('  Will remove:', Number(origCount[0].n) - Number(dedupCount[0].n), 'duplicates')

  console.log('Step 3: Truncating original table...')
  await p.$queryRawUnsafe('TRUNCATE TABLE eci.sos')
  console.log('Step 3 done.')

  console.log('Step 4: Reinserting deduped data...')
  await p.$queryRawUnsafe('INSERT INTO eci.sos SELECT * FROM eci.sos_dedup')
  console.log('Step 4 done.')

  console.log('Step 5: Dropping temp table...')
  await p.$queryRawUnsafe('DROP TABLE eci.sos_dedup')
  console.log('Step 5 done.')

  // Verify
  const finalCount = await p.$queryRawUnsafe('SELECT COUNT(*) as n FROM eci.sos')
  console.log('\nFinal row count:', Number(finalCount[0].n))

  // Verify no duplicates remain
  const check = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as dup_groups FROM (
      SELECT fecha, retail, pais, skuid, categoria, pagina, orden, COUNT(*) as cnt
      FROM eci.sos
      GROUP BY fecha, retail, pais, skuid, categoria, pagina, orden
      HAVING COUNT(*) > 1
    ) sub
  `)
  console.log('Remaining duplicate groups:', Number(check[0].dup_groups))

  // Re-verify SOS
  console.log('\n=== POST-DEDUP SOS (2026-05-27, page 1) ===')
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
    total: Number(r.total_p1), abbott: Number(r.abbott_p1),
    sos: Number(r.sos_pct) + '%'
  })))
}

main().catch(console.error).finally(() => p.$disconnect())
