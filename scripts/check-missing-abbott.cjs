/**
 * Find brands showing as MARCA LOCAL in the MVs that are actually Abbott.
 * Checks eci.sos for brands known to be Abbott that lack a marca_fabricante entry.
 */
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

async function main() {
  // 1. Known Abbott brand names (product lines)
  // These are Abbott's known brands from the sos data
  const knownAbbottBrands = [
    'SIMILAC','PEDIASURE','ENSURE','GLUCERNA','PEDIALYTE','PEDIALYTE ACTIVE',
    'ENSURE ADVANCE','ENSURE PLUS','ENSURE ORIGINAL','ENSURE HIGH PROTEIN',
    'ENSURE ENLIVE','ENSURE SURGERY','ENSURE COMPACT','ENSURE CLEAR',
    'JUVEN','NEPRO','NEPRO HP','OXEPA','PULMOCARE','TRAUMACAL',
    'JEVITY','OSMOLITE','PROMOTE','PERATIVE','PIVOT','VITAL',
    'GLUCERNA SR','GLUCERNA SHAKE','GLUCERNA 1.2','GLUCERNA 1.5',
    'SIMILAC ADVANCE','SIMILAC TOTAL COMFORT','SIMILAC SENSITIVE','SIMILAC PRO',
    'SIMILAC ISOMIL','SIMILAC ARROZ','SIMILAC COMFORT','SIMILAC PURE BLISS',
    'SIMILAC NEOSURE','SIMILAC ALIMENTUM','SIMILAC GO & GROW',
    'PEDIALYTE SPORT','PEDIALYTE FREEZER POPS','PEDIALYTE ADVANCED CARE',
    'PEDIASURE GROW & GAIN','PEDIASURE SIDEKICKS','PEDIASURE COMPLETE',
    'FREEGO','ABOUND','MYOPLEX',
  ]

  // 2. Find all distinct (marca, pais) combos in eci.sos where fabricante is Abbott-related
  //    OR where the marca name suggests Abbott
  const fromSos = await p.$queryRawUnsafe(`
    SELECT UPPER(marca) AS marca, pais, COUNT(*)::int AS cnt,
           MAX(fabricante) AS existing_fab
    FROM eci.sos
    WHERE (
      UPPER(fabricante) LIKE '%ABBOT%'
      OR UPPER(marca) IN (${knownAbbottBrands.map(b => `'${b}'`).join(',')})
    )
    GROUP BY UPPER(marca), pais
    ORDER BY cnt DESC
  `)

  // 3. Check which are already in marca_fabricante
  const existing = await p.$queryRawUnsafe(`
    SELECT UPPER(marca) AS marca, pais FROM eci.marca_fabricante
    WHERE UPPER(fabricante) LIKE '%ABBOT%'
  `)
  const existingSet = new Set(existing.map(r => `${r.marca}||${r.pais}`))

  const missing = fromSos.filter(r => !existingSet.has(`${r.marca}||${r.pais}`))

  console.log(`\n=== Already in marca_fabricante as Abbott (${existing.length} entries) ===`)
  existing.forEach(r => console.log(`  ${String(r.pais).padEnd(4)} ${r.marca}`))

  console.log(`\n=== Missing Abbott brands (${missing.length}) — need to add ===`)
  missing.forEach(r =>
    console.log(`  ${String(r.pais).padEnd(4)} ${String(r.marca).padEnd(30)} (${r.cnt} rows, existing_fab=${r.existing_fab || 'NULL'})`)
  )

  await p.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
