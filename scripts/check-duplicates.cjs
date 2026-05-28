const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Check total duplicates by (fecha, retail, skuid, categoria, pagina, orden)
  console.log('=== DUPLICATE CHECK: (fecha, retail, skuid, categoria, pagina, orden) ===')
  const dupes = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as dup_groups, SUM(cnt - 1) as extra_rows FROM (
      SELECT fecha, retail, skuid, categoria, pagina, orden, COUNT(*) as cnt
      FROM eci.sos
      GROUP BY fecha, retail, skuid, categoria, pagina, orden
      HAVING COUNT(*) > 1
    ) sub
  `)
  console.log('Duplicate groups:', Number(dupes[0].dup_groups), '| Extra rows:', Number(dupes[0].extra_rows))

  // Sample some duplicates
  console.log('\n=== SAMPLE DUPLICATES ===')
  const samples = await p.$queryRawUnsafe(`
    SELECT fecha, retail, pais, categoria, pagina, orden, skuid, COUNT(*) as cnt
    FROM eci.sos
    GROUP BY fecha, retail, pais, categoria, pagina, orden, skuid
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 10
  `)
  console.table(samples.map(r => ({
    fecha: r.fecha, retail: r.retail, pais: r.pais,
    cat: (r.categoria || '').substring(0, 30), pag: Number(r.pagina),
    orden: Number(r.orden), skuid: (r.skuid || '').substring(0, 25), cnt: Number(r.cnt)
  })))

  // Total rows vs unique rows
  console.log('\n=== TOTAL vs UNIQUE ===')
  const total = await p.$queryRawUnsafe('SELECT COUNT(*) as n FROM eci.sos')
  const unique = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as n FROM (
      SELECT DISTINCT fecha, retail, skuid, categoria, pagina, orden FROM eci.sos
    ) sub
  `)
  console.log('Total rows:', Number(total[0].n))
  console.log('Unique rows:', Number(unique[0].n))
  console.log('Duplicates:', Number(total[0].n) - Number(unique[0].n))

  // Distribution of duplicates per retail/country
  console.log('\n=== DUPLICATES BY RETAIL/COUNTRY ===')
  const byRetail = await p.$queryRawUnsafe(`
    SELECT retail, pais, SUM(cnt - 1) as extra_rows FROM (
      SELECT fecha, retail, pais, skuid, categoria, pagina, orden, COUNT(*) as cnt
      FROM eci.sos
      GROUP BY fecha, retail, pais, skuid, categoria, pagina, orden
      HAVING COUNT(*) > 1
    ) sub
    GROUP BY retail, pais
    ORDER BY extra_rows DESC
  `)
  console.table(byRetail.map(r => ({ retail: r.retail, pais: r.pais, extra_rows: Number(r.extra_rows) })))
}

main().catch(console.error).finally(() => p.$disconnect())
