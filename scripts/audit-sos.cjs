const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const BASE = "G:\\.shortcut-targets-by-id\\1-L071oTvKPJY-lVRZOyAYxUiplTpPE7v\\HCSMKT\\Abbot\\SOS\\basesFinales"

// We'll audit: Inkafarma (PE), Cruz Verde (CO), MercadoLibre (MX) for 2026-05-28
const TARGET_DATE = '2026-05-27'

// Map xlsx retail name to DB retail name
const RETAIL_MAP = {
  'Inkafarma': 'INKAFARMA',
  'Mifarma': 'MIFARMA',
  'Tottus': 'TOTTUS',
  'CruzVerde': 'CRUZ VERDE',
  'Rappi': 'RAPPI',
  'Farmatodo': 'FARMATODO',
  'Amazon': 'AMAZON',
  'Farmacias del Ahorro': 'FARMACIA DEL AHORRO',
  'San Pablo': 'FARMACIA SAN PABLO',
  "Sam's Club México": 'SAMS CLUB',
  'Walmart MX': 'WALMART',
}

async function main() {
  // ─── STEP 1: Read xlsx data for target date ───────────────────────
  console.log("=" .repeat(80))
  console.log("STEP 1: XLSX DATA for", TARGET_DATE)
  console.log("=" .repeat(80))

  const countries = [
    { dir: 'Perú', name: 'PE' },
    { dir: 'Colombia', name: 'CO' },
    { dir: 'Mexico', name: 'MX' },
  ]

  const xlsxByRetail = {}

  for (const country of countries) {
    const file = path.join(BASE, country.dir, `ConsolidadoSOS_${TARGET_DATE}.xlsx`)
    if (!fs.existsSync(file)) { console.log(`  [SKIP] ${file} not found`); continue }
    
    const wb = XLSX.readFile(file)
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
    
    for (const row of data) {
      const retail = (row.retail || row.Retail || '').trim()
      if (!xlsxByRetail[retail]) xlsxByRetail[retail] = { country: country.name, rows: [], page1: [] }
      xlsxByRetail[retail].rows.push(row)
      const pagina = Number(row['Página'] || row['Pagina'] || row['página'] || row['pagina'] || 0)
      if (pagina === 1) xlsxByRetail[retail].page1.push(row)
    }
  }

  // Calculate xlsx SOS
  const ABBOTT_MARCAS = ['PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE', 'ELECARE', 'ISOMIL', 'ABBOTT', 'NEPRO', 'OSMOLITE', 'ALITRAQ', 'PEDIALACT', 'PURAMINO', 'NUTRAMIGEN']
  
  console.log("\nXLSX Page 1 SOS by retail:")
  console.log("-".repeat(70))
  const xlsxSos = {}
  for (const [retail, info] of Object.entries(xlsxByRetail)) {
    const p1Total = info.page1.length
    const p1Abbott = info.page1.filter(r => {
      const m = (r.marca || r.Marca || '').toString().trim().toUpperCase()
      return ABBOTT_MARCAS.includes(m) || m.includes('ABBOT')
    }).length
    const sos = p1Total ? ((p1Abbott / p1Total) * 100).toFixed(2) : '0.00'
    xlsxSos[retail] = { total: p1Total, abbott: p1Abbott, sos: parseFloat(sos) }
    console.log(`  ${retail.padEnd(25)} ${info.country}  Total P1: ${String(p1Total).padStart(4)}  Abbott P1: ${String(p1Abbott).padStart(4)}  SOS: ${sos}%`)
  }

  // ─── STEP 2: DB data for same date ────────────────────────────────
  console.log("\n" + "=" .repeat(80))
  console.log("STEP 2: DB DATA for", TARGET_DATE)
  console.log("=" .repeat(80))

  const dbSos = await prisma.$queryRawUnsafe(`
    SELECT retail, pais,
           COUNT(*) as total_p1,
           SUM(CASE WHEN UPPER(fabricante) = 'ABBOTT' THEN 1 ELSE 0 END) as abbott_p1,
           ROUND(100.0 * SUM(CASE WHEN UPPER(fabricante) = 'ABBOTT' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as sos_pct
    FROM eci.sos
    WHERE pagina = 1 AND fecha = '${TARGET_DATE}'
    GROUP BY retail, pais
    ORDER BY retail
  `)
  
  console.log("\nDB Page 1 SOS by retail:")
  console.log("-".repeat(70))
  const dbByRetail = {}
  for (const r of dbSos) {
    dbByRetail[r.retail] = { total: Number(r.total_p1), abbott: Number(r.abbott_p1), sos: Number(r.sos_pct), pais: r.pais }
    console.log(`  ${r.retail.padEnd(25)} ${r.pais}  Total P1: ${String(Number(r.total_p1)).padStart(4)}  Abbott P1: ${String(Number(r.abbott_p1)).padStart(4)}  SOS: ${Number(r.sos_pct)}%`)
  }

  // ─── STEP 3: Compare xlsx vs DB ───────────────────────────────────
  console.log("\n" + "=" .repeat(80))
  console.log("STEP 3: COMPARISON xlsx vs DB")
  console.log("=" .repeat(80))
  
  for (const [xlsxRetail, dbRetail] of Object.entries(RETAIL_MAP)) {
    const xlsx = xlsxSos[xlsxRetail]
    const db = dbByRetail[dbRetail]
    if (!xlsx && !db) continue
    
    const xlsxStr = xlsx ? `Total=${xlsx.total} Abbott=${xlsx.abbott} SOS=${xlsx.sos}%` : '[NOT IN XLSX]'
    const dbStr = db ? `Total=${db.total} Abbott=${db.abbott} SOS=${db.sos}%` : '[NOT IN DB]'
    
    const totalDiff = (xlsx && db) ? db.total - xlsx.total : '?'
    const abbottDiff = (xlsx && db) ? db.abbott - xlsx.abbott : '?'
    const match = (xlsx && db) ? (xlsx.total === db.total && xlsx.abbott === db.abbott ? '✓ MATCH' : '✗ MISMATCH') : '? N/A'
    
    console.log(`\n  ${xlsxRetail} → ${dbRetail}`)
    console.log(`    XLSX: ${xlsxStr}`)
    console.log(`    DB:   ${dbStr}`)
    console.log(`    Diff: total=${totalDiff}, abbott=${abbottDiff}  ${match}`)
  }

  // ─── STEP 4: Detailed row-level check for mismatches ──────────────
  console.log("\n" + "=" .repeat(80))
  console.log("STEP 4: DETAILED ROW CHECK")
  console.log("=" .repeat(80))

  // Check Inkafarma specifically
  const retail = 'Inkafarma'
  const dbRetail = 'INKAFARMA'
  const xlsxData = xlsxByRetail[retail]
  
  if (xlsxData) {
    // Get DB rows for same date/retail on page 1
    const dbRows = await prisma.$queryRawUnsafe(`
      SELECT titulo, marca, fabricante, "orden", pagina
      FROM eci.sos
      WHERE retail = '${dbRetail}' AND fecha = '${TARGET_DATE}' AND pagina = 1
      ORDER BY categoria, "orden"
    `)
    
    console.log(`\n  ${retail}: xlsx page1=${xlsxData.page1.length} rows, db page1=${dbRows.length} rows`)
    
    // Check if DB has extra rows not in xlsx
    if (dbRows.length !== xlsxData.page1.length) {
      console.log(`    ⚠ ROW COUNT MISMATCH: DB has ${dbRows.length - xlsxData.page1.length} more rows than xlsx`)
    }
    
    // Check DB rows where fabricante != ABBOTT but marca is Abbott brand
    const dbMissing = dbRows.filter(r => 
      r.fabricante !== 'ABBOTT' && ABBOTT_MARCAS.includes((r.marca || '').toUpperCase())
    )
    if (dbMissing.length) {
      console.log(`    ⚠ ${dbMissing.length} rows with Abbott marca but fabricante != ABBOTT:`)
      dbMissing.slice(0, 5).forEach(r => console.log(`      marca=${r.marca} fab=${r.fabricante} titulo=${(r.titulo||'').substring(0,50)}`))
    }
    
    // Check DB rows where fabricante is NULL/empty
    const dbNull = dbRows.filter(r => !r.fabricante || r.fabricante === '')
    if (dbNull.length) {
      console.log(`    ⚠ ${dbNull.length} rows with NULL/empty fabricante:`)
      dbNull.slice(0, 5).forEach(r => console.log(`      marca=${r.marca} titulo=${(r.titulo||'').substring(0,50)}`))
    }

    // Check xlsx rows that should be Abbott but might be missed
    const xlsxAbbott = xlsxData.page1.filter(r => {
      const m = (r.marca || '').toUpperCase()
      return ABBOTT_MARCAS.includes(m) || m.includes('ABBOT')
    })
    const xlsxNonAbbott = xlsxData.page1.filter(r => {
      const m = (r.marca || '').toUpperCase()
      return !ABBOTT_MARCAS.includes(m) && !m.includes('ABBOT')
    })
    
    // Check non-Abbott xlsx rows to see if any are actually Abbott products by title
    const possibleMissed = xlsxNonAbbott.filter(r => {
      const t = (r.titulo || '').toUpperCase()
      return t.includes('PEDIASURE') || t.includes('ENSURE') || t.includes('SIMILAC') || t.includes('GLUCERNA') || t.includes('ABBOTT')
    })
    if (possibleMissed.length) {
      console.log(`    ⚠ ${possibleMissed.length} xlsx rows with Abbott keywords in titulo but non-Abbott marca:`)
      possibleMissed.slice(0, 10).forEach(r => console.log(`      marca="${r.marca}" titulo="${(r.titulo||'').substring(0,60)}"`))
    }
  }

  // Do same for Cruz Verde
  const retail2 = 'CruzVerde'
  const dbRetail2 = 'CRUZ VERDE'
  const xlsxData2 = xlsxByRetail[retail2]
  
  if (xlsxData2) {
    const dbRows2 = await prisma.$queryRawUnsafe(`
      SELECT titulo, marca, fabricante, "orden", pagina
      FROM eci.sos
      WHERE retail = '${dbRetail2}' AND fecha = '${TARGET_DATE}' AND pagina = 1
      ORDER BY categoria, "orden"
    `)
    
    console.log(`\n  CruzVerde: xlsx page1=${xlsxData2.page1.length} rows, db page1=${dbRows2.length} rows`)
    
    if (dbRows2.length !== xlsxData2.page1.length) {
      console.log(`    ⚠ ROW COUNT MISMATCH: DB has ${dbRows2.length - xlsxData2.page1.length} more rows than xlsx`)
    }
    
    const dbMissing2 = dbRows2.filter(r => 
      r.fabricante !== 'ABBOTT' && ABBOTT_MARCAS.includes((r.marca || '').toUpperCase())
    )
    if (dbMissing2.length) {
      console.log(`    ⚠ ${dbMissing2.length} rows with Abbott marca but fabricante != ABBOTT:`)
      dbMissing2.slice(0, 5).forEach(r => console.log(`      marca=${r.marca} fab=${r.fabricante} titulo=${(r.titulo||'').substring(0,50)}`))
    }

    const dbNull2 = dbRows2.filter(r => !r.fabricante || r.fabricante === '')
    if (dbNull2.length) {
      console.log(`    ⚠ ${dbNull2.length} rows with NULL/empty fabricante:`)
      dbNull2.slice(0, 5).forEach(r => console.log(`      marca=${r.marca} titulo=${(r.titulo||'').substring(0,50)}`))
    }
  }

  // ─── STEP 5: Check ranking/pagina distribution ────────────────────
  console.log("\n" + "=" .repeat(80))
  console.log("STEP 5: RANKING/PAGINA DISTRIBUTION CHECK")
  console.log("=" .repeat(80))

  // Check if the DB has correct ranking values per page
  const rankCheck = await prisma.$queryRawUnsafe(`
    SELECT retail, pais,
           MIN(ranking) as min_rank, MAX(ranking) as max_rank,
           COUNT(DISTINCT pagina) as pages,
           COUNT(*) as total_rows
    FROM eci.sos
    WHERE fecha = '${TARGET_DATE}'
    GROUP BY retail, pais
    ORDER BY retail
  `)
  console.log("\nRanking distribution by retail:")
  console.table(rankCheck.map(r => ({
    retail: r.retail, pais: r.pais,
    min_rank: Number(r.min_rank), max_rank: Number(r.max_rank),
    pages: Number(r.pages), total: Number(r.total_rows)
  })))

  // Check page counts - how many items per page?
  const pageCheck = await prisma.$queryRawUnsafe(`
    SELECT retail, pagina, COUNT(*) as items
    FROM eci.sos
    WHERE fecha = '${TARGET_DATE}' AND retail = 'INKAFARMA'
    GROUP BY retail, pagina
    ORDER BY pagina
    LIMIT 10
  `)
  console.log("\nInkafarma items per page:")
  console.table(pageCheck.map(r => ({ page: Number(r.pagina), items: Number(r.items) })))

  // Check categories in DB vs xlsx for Inkafarma
  const dbCats = await prisma.$queryRawUnsafe(`
    SELECT categoria, COUNT(*) as cnt
    FROM eci.sos
    WHERE fecha = '${TARGET_DATE}' AND retail = 'INKAFARMA' AND pagina = 1
    GROUP BY categoria ORDER BY cnt DESC
  `)
  console.log("\nInkafarma DB categories on page 1:")
  console.table(dbCats.map(r => ({ categoria: r.categoria, count: Number(r.cnt) })))

  if (xlsxData) {
    const xlsxCats = {}
    xlsxData.page1.forEach(r => {
      const cat = r.categoria || '[NULL]'
      xlsxCats[cat] = (xlsxCats[cat] || 0) + 1
    })
    console.log("\nInkafarma XLSX categories on page 1:")
    console.table(Object.entries(xlsxCats).sort((a,b) => b[1]-a[1]).map(([cat, cnt]) => ({ categoria: cat, count: cnt })))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
