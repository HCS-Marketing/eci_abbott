const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Check existing Abbott variants
  const variants = await prisma.$queryRawUnsafe(`
    SELECT fabricante, COUNT(*) as cnt
    FROM eci.sos
    WHERE UPPER(fabricante) LIKE '%ABBOT%' AND fabricante != 'ABBOTT'
    GROUP BY fabricante ORDER BY cnt DESC
  `)
  console.log('Abbott variants to unify:')
  console.table(variants.map(r => ({ fabricante: r.fabricante, count: Number(r.cnt) })))

  // Unify all to ABBOTT
  await prisma.$queryRawUnsafe(`
    UPDATE eci.sos SET fabricante = 'ABBOTT'
    WHERE UPPER(fabricante) LIKE '%ABBOT%' AND fabricante != 'ABBOTT'
  `)
  console.log('\nUnified all to ABBOTT')

  // Verify
  const check = await prisma.$queryRawUnsafe(`
    SELECT fabricante, COUNT(*) as cnt FROM eci.sos
    WHERE UPPER(fabricante) LIKE '%ABBOT%' GROUP BY fabricante
  `)
  console.log('\nVerification:')
  console.table(check.map(r => ({ fabricante: r.fabricante, count: Number(r.cnt) })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
