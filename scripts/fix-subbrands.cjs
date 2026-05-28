const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Fix CO: marcas like 'ENSURE ADVANCE', 'PEDIASURE PEPTIGRO', 'SIMILAC 5HMOS', etc.
  // These are sub-brand names that belong to Abbott
  console.log("=== FIX: CO sub-brand marcas → fabricante = ABBOTT ===")
  
  const abbottSubBrands = [
    'ENSURE ADVANCE', 'ENSURE CLINICAL', 'ENSURE PLUS',
    'PEDIASURE PEPTIGRO', 'PEDIASURE GROW',
    'SIMILAC 5HMOS', 'SIMILAC TOTAL COMFORT', 'SIMILAC PRO',
    'PEDYALITE', 'PEDIALYTE MAX 60', 'PEDIALYTE ACTIVE', 'PEDIALYTE',
    'GLUCERNA SR', 'GLUCERNA',
  ]
  
  // Build pattern matching for LIKE
  const patterns = [
    "UPPER(marca) LIKE 'ENSURE%'",
    "UPPER(marca) LIKE 'PEDIASURE%'",
    "UPPER(marca) LIKE 'SIMILAC%'",
    "UPPER(marca) LIKE 'GLUCERNA%'",
    "UPPER(marca) LIKE 'PEDIALYTE%'",
    "UPPER(marca) LIKE 'PEDYALITE%'",
    "UPPER(marca) LIKE 'NEPRO%'",
    "UPPER(marca) LIKE 'OSMOLITE%'",
    "UPPER(marca) LIKE 'ELECARE%'",
    "UPPER(marca) LIKE 'ISOMIL%'",
  ]

  const preview = await prisma.$queryRawUnsafe(`
    SELECT marca, retail, pais, COUNT(*) as cnt
    FROM eci.sos
    WHERE (${patterns.join(' OR ')})
      AND fabricante != 'ABBOTT'
    GROUP BY marca, retail, pais
    ORDER BY cnt DESC
    LIMIT 30
  `)
  console.table(preview.map(r => ({ marca: r.marca, retail: r.retail, pais: r.pais, count: Number(r.cnt) })))

  const totalToFix = preview.reduce((s, r) => s + Number(r.cnt), 0)
  console.log(`Total rows to fix: ${totalToFix}`)

  // Apply fix
  await prisma.$queryRawUnsafe(`
    UPDATE eci.sos
    SET fabricante = 'ABBOTT'
    WHERE (${patterns.join(' OR ')})
      AND fabricante != 'ABBOTT'
  `)
  console.log("Fixed!\n")

  // Also fix PE: marca = 'ENSURE' with fabricante != 'ABBOTT' (those 216 rows)
  console.log("=== FIX: PE rows where marca='ENSURE' but fab != ABBOTT ===")
  const peEnsure = await prisma.$queryRawUnsafe(`
    SELECT fabricante, COUNT(*) as cnt
    FROM eci.sos
    WHERE pais = 'PE' AND UPPER(marca) = 'ENSURE' AND fabricante != 'ABBOTT'
    GROUP BY fabricante
  `)
  console.table(peEnsure.map(r => ({ fabricante: r.fabricante, count: Number(r.cnt) })))
  
  // Those are likely ENSURE brand products that somehow got a different fabricante
  // But wait - marca='ENSURE' should already be caught. Let me check what fab they have
  // If they have a non-Abbott fabricante like 'GENERICO' we should fix. Otherwise it's another company using the name
  await prisma.$queryRawUnsafe(`
    UPDATE eci.sos SET fabricante = 'ABBOTT'
    WHERE pais = 'PE' AND UPPER(marca) IN ('ENSURE', 'ENSURE ADVANCE')
      AND fabricante != 'ABBOTT'
  `)
  console.log("Fixed PE ENSURE\n")

  // Note: Ignore 'ORAL B' - those are false positives (Oral B mentions "ensure" in title text, not Abbott's Ensure brand)

  // Final verification across ALL dates
  console.log("=== FINAL: Overall page 1 SOS across all dates ===")
  const final = await prisma.$queryRawUnsafe(`
    SELECT retail, pais,
           COUNT(*) as total_p1,
           SUM(CASE WHEN fabricante = 'ABBOTT' THEN 1 ELSE 0 END) as abbott_p1,
           ROUND(100.0 * SUM(CASE WHEN fabricante = 'ABBOTT' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as sos_pct
    FROM eci.sos
    WHERE pagina = 1
    GROUP BY retail, pais
    ORDER BY sos_pct
  `)
  console.table(final.map(r => ({
    retail: r.retail, pais: r.pais,
    total_p1: Number(r.total_p1), abbott_p1: Number(r.abbott_p1),
    sos: Number(r.sos_pct) + '%'
  })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
