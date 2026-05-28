const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // FIX 1: Set fabricante='ABBOTT' where fabricante matches an Abbott brand name
  // (e.g., fab='ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIASURE' instead of 'ABBOTT')
  console.log("=== FIX 1: fabricante set to brand name instead of ABBOTT ===")
  const ABBOTT_BRANDS = [
    'PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE',
    'ELECARE', 'ISOMIL', 'NEPRO', 'OSMOLITE', 'ALITRAQ',
    'PEDIALACT', 'PURAMINO', 'NUTRAMIGEN'
  ]
  const brandList = ABBOTT_BRANDS.map(b => `'${b}'`).join(', ')
  
  const preview1 = await prisma.$queryRawUnsafe(`
    SELECT fabricante, COUNT(*) as cnt
    FROM eci.sos
    WHERE UPPER(fabricante) IN (${brandList})
    GROUP BY fabricante ORDER BY cnt DESC
  `)
  console.log("Rows with fabricante = brand name:")
  console.table(preview1.map(r => ({ fabricante: r.fabricante, count: Number(r.cnt) })))

  await prisma.$queryRawUnsafe(`
    UPDATE eci.sos SET fabricante = 'ABBOTT'
    WHERE UPPER(fabricante) IN (${brandList})
  `)
  console.log("Fixed: set all to ABBOTT\n")

  // FIX 2: Cruz Verde still has fabricante='GENERICO' for Abbott brands on page 1
  // (check if our earlier fix didn't catch all of them)
  console.log("=== FIX 2: Check remaining GENERICO for Abbott brands ===")
  const remaining = await prisma.$queryRawUnsafe(`
    SELECT retail, COUNT(*) as cnt
    FROM eci.sos
    WHERE UPPER(marca) IN (${brandList}, 'ABBOTT')
      AND (fabricante IS NULL OR fabricante = '' OR UPPER(fabricante) = 'GENERICO')
    GROUP BY retail ORDER BY cnt DESC
  `)
  console.table(remaining.map(r => ({ retail: r.retail, count: Number(r.cnt) })))
  
  if (remaining.length > 0) {
    await prisma.$queryRawUnsafe(`
      UPDATE eci.sos SET fabricante = 'ABBOTT'
      WHERE UPPER(marca) IN (${brandList}, 'ABBOTT')
        AND (fabricante IS NULL OR fabricante = '' OR UPPER(fabricante) = 'GENERICO')
    `)
    console.log("Fixed remaining\n")
  }

  // FIX 3: Check the pagina issue - Inkafarma has ranking=0.5 for ALL rows and pagina
  // is based on ordinal position. Let's check what's happening.
  console.log("=== DIAGNOSIS: Inkafarma pagina/ranking for 2026-05-27 ===")
  const inkaDiag = await prisma.$queryRawUnsafe(`
    SELECT pagina, ranking, "orden", COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'INKAFARMA' AND fecha = '2026-05-27'
    GROUP BY pagina, ranking, "orden"
    ORDER BY pagina, "orden"
    LIMIT 20
  `)
  console.table(inkaDiag.map(r => ({ pagina: Number(r.pagina), ranking: Number(r.ranking), orden: Number(r.orden), count: Number(r.cnt) })))

  // Check Tottus
  console.log("\n=== DIAGNOSIS: Tottus pagina/ranking for 2026-05-27 ===")
  const tottusDiag = await prisma.$queryRawUnsafe(`
    SELECT pagina, ranking, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'TOTTUS' AND fecha = '2026-05-27'
    GROUP BY pagina, ranking ORDER BY pagina
  `)
  console.table(tottusDiag.map(r => ({ pagina: Number(r.pagina), ranking: Number(r.ranking), count: Number(r.cnt) })))

  // Check how many distinct categories are on page 1 for Inkafarma in DB vs xlsx
  console.log("\n=== DIAGNOSIS: Inkafarma categories with page 1 row counts ===")
  const inkaCats = await prisma.$queryRawUnsafe(`
    SELECT categoria, 
           COUNT(*) FILTER (WHERE pagina = 1) as p1_count,
           COUNT(*) as total_count
    FROM eci.sos
    WHERE retail = 'INKAFARMA' AND fecha = '2026-05-27'
    GROUP BY categoria
    HAVING COUNT(*) FILTER (WHERE pagina = 1) > 0 OR COUNT(*) > 20
    ORDER BY p1_count DESC
  `)
  console.table(inkaCats.map(r => ({ categoria: r.categoria, p1: Number(r.p1_count), total: Number(r.total_count) })))

  // Check if there are categories that have no page 1 but should
  console.log("\n=== DIAGNOSIS: Inkafarma categories with 0 page-1 rows ===")
  const inkaNoP1 = await prisma.$queryRawUnsafe(`
    SELECT categoria, COUNT(*) as total, MIN(pagina) as min_page, MAX(pagina) as max_page
    FROM eci.sos
    WHERE retail = 'INKAFARMA' AND fecha = '2026-05-27'
    GROUP BY categoria
    HAVING COUNT(*) FILTER (WHERE pagina = 1) = 0
    ORDER BY total DESC
  `)
  console.table(inkaNoP1.map(r => ({ categoria: r.categoria, total: Number(r.total), min_page: Number(r.min_page), max_page: Number(r.max_page) })))

  // FINAL: Verify SOS after fixes
  console.log("\n=== VERIFICATION: Page 1 SOS after fixes (2026-05-27) ===")
  const verify = await prisma.$queryRawUnsafe(`
    SELECT retail, pais,
           COUNT(*) as total_p1,
           SUM(CASE WHEN fabricante = 'ABBOTT' THEN 1 ELSE 0 END) as abbott_p1,
           ROUND(100.0 * SUM(CASE WHEN fabricante = 'ABBOTT' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as sos_pct
    FROM eci.sos
    WHERE pagina = 1 AND fecha = '2026-05-27'
    GROUP BY retail, pais
    ORDER BY retail
  `)
  console.table(verify.map(r => ({
    retail: r.retail, pais: r.pais,
    total_p1: Number(r.total_p1), abbott_p1: Number(r.abbott_p1),
    sos: Number(r.sos_pct) + '%'
  })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
