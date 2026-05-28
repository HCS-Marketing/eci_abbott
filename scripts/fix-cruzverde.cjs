const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // FIX: Cruz Verde, Drogueria Virtual, Rappi, Rebaja Virtual in CO use
  // marca = 'ABBOTT LABORATORIES DE COLOMBIA' (full legal name)
  // Also check for any other patterns with 'ABBOTT' in marca
  
  console.log("=== Check marca values containing 'ABBOTT' ===")
  const abbottMarcas = await prisma.$queryRawUnsafe(`
    SELECT marca, retail, COUNT(*) as cnt
    FROM eci.sos
    WHERE UPPER(marca) LIKE '%ABBOT%'
      AND fabricante != 'ABBOTT'
    GROUP BY marca, retail
    ORDER BY cnt DESC
    LIMIT 20
  `)
  console.table(abbottMarcas.map(r => ({ marca: r.marca, retail: r.retail, count: Number(r.cnt) })))

  // FIX: Set fabricante = 'ABBOTT' where marca contains 'ABBOTT' (legal name variations)
  console.log("\n=== Fixing: set fabricante='ABBOTT' where marca LIKE '%ABBOT%' ===")
  const result = await prisma.$queryRawUnsafe(`
    UPDATE eci.sos
    SET fabricante = 'ABBOTT'
    WHERE UPPER(marca) LIKE '%ABBOT%'
      AND fabricante != 'ABBOTT'
  `)
  console.log("Done")

  // Also check for other variations of Abbott-related marcas in CO
  console.log("\n=== Check CO marcas that might be Abbott (looking at titles) ===")
  const coCheck = await prisma.$queryRawUnsafe(`
    SELECT marca, COUNT(*) as cnt
    FROM eci.sos
    WHERE pais = 'CO' AND fabricante != 'ABBOTT'
      AND (
        UPPER(titulo) LIKE '%PEDIASURE%'
        OR UPPER(titulo) LIKE '%ENSURE%'
        OR UPPER(titulo) LIKE '%SIMILAC%'
        OR UPPER(titulo) LIKE '%GLUCERNA%'
        OR UPPER(titulo) LIKE '%PEDIALYTE%'
      )
    GROUP BY marca
    ORDER BY cnt DESC
    LIMIT 20
  `)
  console.table(coCheck.map(r => ({ marca: r.marca, count: Number(r.cnt) })))

  // Same for MX
  console.log("\n=== Check MX marcas where titulo has Abbott brand names ===")
  const mxCheck = await prisma.$queryRawUnsafe(`
    SELECT marca, COUNT(*) as cnt
    FROM eci.sos
    WHERE pais = 'MX' AND fabricante != 'ABBOTT'
      AND (
        UPPER(titulo) LIKE '%PEDIASURE%'
        OR UPPER(titulo) LIKE '%ENSURE%'
        OR UPPER(titulo) LIKE '%SIMILAC%'
        OR UPPER(titulo) LIKE '%GLUCERNA%'
        OR UPPER(titulo) LIKE '%PEDIALYTE%'
      )
    GROUP BY marca
    ORDER BY cnt DESC
    LIMIT 20
  `)
  console.table(mxCheck.map(r => ({ marca: r.marca, count: Number(r.cnt) })))

  // Same for PE
  console.log("\n=== Check PE marcas where titulo has Abbott brand names but fab != ABBOTT ===")
  const peCheck = await prisma.$queryRawUnsafe(`
    SELECT marca, COUNT(*) as cnt
    FROM eci.sos
    WHERE pais = 'PE' AND fabricante != 'ABBOTT'
      AND (
        UPPER(titulo) LIKE '%PEDIASURE%'
        OR UPPER(titulo) LIKE '%ENSURE%'
        OR UPPER(titulo) LIKE '%SIMILAC%'
        OR UPPER(titulo) LIKE '%GLUCERNA%'
        OR UPPER(titulo) LIKE '%PEDIALYTE%'
      )
    GROUP BY marca
    ORDER BY cnt DESC
    LIMIT 20
  `)
  console.table(peCheck.map(r => ({ marca: r.marca, count: Number(r.cnt) })))

  // Verify Cruz Verde SOS after fix
  console.log("\n=== VERIFICATION: Page 1 SOS for 2026-05-27 ===")
  const verify = await prisma.$queryRawUnsafe(`
    SELECT retail, pais,
           COUNT(*) as total_p1,
           SUM(CASE WHEN fabricante = 'ABBOTT' THEN 1 ELSE 0 END) as abbott_p1,
           ROUND(100.0 * SUM(CASE WHEN fabricante = 'ABBOTT' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as sos_pct
    FROM eci.sos
    WHERE pagina = 1 AND fecha = '2026-05-27'
    GROUP BY retail, pais
    ORDER BY sos_pct
  `)
  console.table(verify.map(r => ({
    retail: r.retail, pais: r.pais,
    total_p1: Number(r.total_p1), abbott_p1: Number(r.abbott_p1),
    sos: Number(r.sos_pct) + '%'
  })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
