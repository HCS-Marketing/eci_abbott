const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 1. Cruz Verde: What fabricante do Abbott-brand products have?
  console.log("=== CRUZ VERDE: fabricante for Abbott-brand products (PEDIASURE, ENSURE, SIMILAC, GLUCERNA) ===")
  const cvAbbott = await prisma.$queryRawUnsafe(`
    SELECT fabricante, marca, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'CRUZ VERDE'
      AND UPPER(marca) IN ('PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE', 'ABBOTT', 'ELECARE', 'ISOMIL')
    GROUP BY fabricante, marca
    ORDER BY cnt DESC
    LIMIT 30
  `)
  console.table(cvAbbott.map(r => ({ fabricante: r.fabricante, marca: r.marca, count: Number(r.cnt) })))

  // 2. All Colombia: What fabricante values are used for Abbott brands?
  console.log("\n=== ALL CO: fabricante for Abbott-brand products ===")
  const coAbbott = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT fabricante, retail
    FROM eci.sos
    WHERE pais = 'CO'
      AND UPPER(marca) IN ('PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE', 'ABBOTT', 'ELECARE', 'ISOMIL')
      AND fabricante IS NOT NULL AND fabricante != ''
    ORDER BY fabricante
  `)
  console.table(coAbbott.map(r => ({ fabricante: r.fabricante, retail: r.retail })))

  // 3. Rappi CO: What fabricante for Abbott brands?
  console.log("\n=== RAPPI CO: fabricante for Abbott brands ===")
  const rappiAbbott = await prisma.$queryRawUnsafe(`
    SELECT fabricante, marca, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'RAPPI' AND pais = 'CO'
      AND UPPER(marca) IN ('PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE', 'ABBOTT', 'ELECARE', 'ISOMIL')
    GROUP BY fabricante, marca
    ORDER BY cnt DESC
    LIMIT 20
  `)
  console.table(rappiAbbott.map(r => ({ fabricante: r.fabricante, marca: r.marca, count: Number(r.cnt) })))

  // 4. Check ALL fabricante values in CO to see what Abbott is called
  console.log("\n=== CO: ALL DISTINCT fabricante values (top 30 by count) ===")
  const coFabs = await prisma.$queryRawUnsafe(`
    SELECT fabricante, COUNT(*) as cnt
    FROM eci.sos
    WHERE pais = 'CO' AND fabricante IS NOT NULL AND fabricante != ''
    GROUP BY fabricante
    ORDER BY cnt DESC
    LIMIT 30
  `)
  console.table(coFabs.map(r => ({ fabricante: r.fabricante, count: Number(r.cnt) })))

  // 5. MX: Check what marca values exist for Abbott brands (no fabricante at all)
  console.log("\n=== MX: Abbott brands marca count (fabricante all NULL) ===")
  const mxAbbott = await prisma.$queryRawUnsafe(`
    SELECT marca, retail, COUNT(*) as cnt
    FROM eci.sos
    WHERE pais = 'MX'
      AND UPPER(marca) IN ('PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE', 'ABBOTT', 'ELECARE', 'ISOMIL')
    GROUP BY marca, retail
    ORDER BY cnt DESC
    LIMIT 20
  `)
  console.table(mxAbbott.map(r => ({ marca: r.marca, retail: r.retail, count: Number(r.cnt) })))

  // 6. Tottus PE: check fabricante
  console.log("\n=== TOTTUS PE: fabricante for Abbott brands ===")
  const tottus = await prisma.$queryRawUnsafe(`
    SELECT fabricante, marca, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'TOTTUS'
      AND UPPER(marca) IN ('PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE', 'ABBOTT', 'ELECARE', 'ISOMIL')
    GROUP BY fabricante, marca
    ORDER BY cnt DESC
    LIMIT 20
  `)
  console.table(tottus.map(r => ({ fabricante: r.fabricante, marca: r.marca, count: Number(r.cnt) })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
