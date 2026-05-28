// Compare DB fabricante coverage vs xlsx marca for low-SOS retailers
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 1. Check fabricante coverage by retail
  console.log("=== DB: fabricante NULL/empty by retail ===")
  const fabCoverage = await prisma.$queryRawUnsafe(`
    SELECT retail, 
           COUNT(*) as total,
           COUNT(fabricante) as with_fab,
           SUM(CASE WHEN fabricante IS NULL OR fabricante = '' THEN 1 ELSE 0 END) as no_fab,
           ROUND(100.0 * COUNT(fabricante) / COUNT(*), 1) as pct_with_fab
    FROM eci.sos
    GROUP BY retail
    ORDER BY retail
  `)
  console.table(fabCoverage.map(r => ({
    retail: r.retail,
    total: Number(r.total),
    with_fab: Number(r.with_fab),
    no_fab: Number(r.no_fab),
    pct: Number(r.pct_with_fab) + '%'
  })))

  // 2. For low-SOS retailers, check page 1 Abbott SOS
  console.log("\n=== DB: Page 1 SOS for target retailers ===")
  const lowSos = await prisma.$queryRawUnsafe(`
    SELECT retail, pais,
           COUNT(*) as total_p1,
           SUM(CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 1 ELSE 0 END) as abbott_p1,
           ROUND(100.0 * SUM(CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as abbott_sos_pct
    FROM eci.sos
    WHERE pagina = 1
      AND retail IN ('INKAFARMA', 'MIFARMA', 'MERCADOLIBRE', 'CRUZ VERDE', 'CRUZVERDE')
    GROUP BY retail, pais
    ORDER BY retail, pais
  `)
  console.table(lowSos.map(r => ({
    retail: r.retail,
    pais: r.pais,
    total_p1: Number(r.total_p1),
    abbott_p1: Number(r.abbott_p1),
    sos_pct: Number(r.abbott_sos_pct) + '%'
  })))

  // 3. Check page 1 items with NULL fabricante for these retailers
  console.log("\n=== DB: Page 1 items with NULL fabricante (low-SOS retailers) ===")
  const nullFab = await prisma.$queryRawUnsafe(`
    SELECT retail, pais,
           COUNT(*) as null_fab_p1,
           (SELECT COUNT(*) FROM eci.sos s2 WHERE s2.retail = s.retail AND s2.pais = s.pais AND s2.pagina = 1) as total_p1
    FROM eci.sos s
    WHERE pagina = 1
      AND (fabricante IS NULL OR fabricante = '')
      AND retail IN ('INKAFARMA', 'MIFARMA', 'MERCADOLIBRE', 'CRUZ VERDE', 'CRUZVERDE')
    GROUP BY retail, pais
    ORDER BY retail, pais
  `)
  console.table(nullFab.map(r => ({
    retail: r.retail,
    pais: r.pais,
    null_fab_p1: Number(r.null_fab_p1),
    total_p1: Number(r.total_p1),
    pct_missing: ((Number(r.null_fab_p1)/Number(r.total_p1))*100).toFixed(1) + '%'
  })))

  // 4. For CruzVerde specifically - check marca distribution on page 1 with no fabricante
  console.log("\n=== DB: CruzVerde page 1 - marca breakdown where fabricante IS NULL ===")
  const cvMarcas = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(marca, '[NULL]') as marca, COUNT(*) as cnt
    FROM eci.sos
    WHERE pagina = 1
      AND retail IN ('CRUZ VERDE', 'CRUZVERDE')
      AND (fabricante IS NULL OR fabricante = '')
    GROUP BY marca
    ORDER BY cnt DESC
    LIMIT 20
  `)
  console.table(cvMarcas.map(r => ({ marca: r.marca, count: Number(r.cnt) })))

  // 5. Check ALL retailers page 1 SOS to see which are actually low
  console.log("\n=== DB: ALL retailers page 1 Abbott SOS ===")
  const allSos = await prisma.$queryRawUnsafe(`
    SELECT retail, pais,
           COUNT(*) as total_p1,
           SUM(CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 1 ELSE 0 END) as abbott_p1,
           ROUND(100.0 * SUM(CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as abbott_sos_pct,
           SUM(CASE WHEN fabricante IS NULL OR fabricante = '' THEN 1 ELSE 0 END) as null_fab
    FROM eci.sos
    WHERE pagina = 1
    GROUP BY retail, pais
    ORDER BY abbott_sos_pct ASC
  `)
  console.table(allSos.map(r => ({
    retail: r.retail,
    pais: r.pais,
    total_p1: Number(r.total_p1),
    abbott_p1: Number(r.abbott_p1),
    sos_pct: Number(r.abbott_sos_pct) + '%',
    null_fab: Number(r.null_fab)
  })))

  // 6. Check MercadoLibre specifically
  console.log("\n=== DB: MercadoLibre - does it exist? ===")
  const ml = await prisma.$queryRawUnsafe(`
    SELECT retail, pais, COUNT(*) as cnt
    FROM eci.sos
    WHERE UPPER(retail) LIKE '%MERCADO%'
    GROUP BY retail, pais
  `)
  console.table(ml.map(r => ({ retail: r.retail, pais: r.pais, count: Number(r.cnt) })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
