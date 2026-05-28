const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')
const prisma = new PrismaClient()

const BASE = "G:\\.shortcut-targets-by-id\\1-L071oTvKPJY-lVRZOyAYxUiplTpPE7v\\HCSMKT\\Abbot\\SOS\\basesFinales"
const TARGET_DATE = '2026-05-27'

const RETAIL_MAP = {
  'Inkafarma': 'INKAFARMA', 'Mifarma': 'MIFARMA', 'Tottus': 'TOTTUS',
  'CruzVerde': 'CRUZ VERDE', 'Rappi': 'RAPPI', 'Farmatodo': 'FARMATODO',
  'Amazon': 'AMAZON', 'Benavides': 'BENAVIDES',
  'Farmacias del Ahorro': 'FARMACIA DEL AHORRO', 'San Pablo': 'FARMACIA SAN PABLO',
  "Sam's Club México": 'SAMS CLUB', 'Walmart MX': 'WALMART',
}

const ABBOTT_MARCAS = ['PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE', 'ELECARE', 'ISOMIL', 'ABBOTT', 'NEPRO', 'OSMOLITE', 'ALITRAQ', 'PEDIALACT', 'PURAMINO', 'NUTRAMIGEN']
const ABBOTT_PATTERNS = ['ENSURE', 'PEDIASURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE', 'PEDYALITE', 'ABBOT']

async function main() {
  // Read xlsx
  const xlsxSos = {}
  for (const { dir, name } of [{ dir: 'Perú', name: 'PE' }, { dir: 'Colombia', name: 'CO' }, { dir: 'Mexico', name: 'MX' }]) {
    const file = path.join(BASE, dir, `ConsolidadoSOS_${TARGET_DATE}.xlsx`)
    if (!fs.existsSync(file)) continue
    const data = XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets['Sheet1'])
    for (const row of data) {
      const retail = (row.retail || '').trim()
      const pagina = Number(row['Página'] || row['Pagina'] || 0)
      if (pagina !== 1) continue
      if (!xlsxSos[retail]) xlsxSos[retail] = { total: 0, abbott: 0 }
      xlsxSos[retail].total++
      const m = (row.marca || '').toString().toUpperCase()
      if (ABBOTT_MARCAS.includes(m) || ABBOTT_PATTERNS.some(p => m.includes(p))) {
        xlsxSos[retail].abbott++
      }
    }
  }

  // Read DB
  const dbRows = await prisma.$queryRawUnsafe(`
    SELECT retail,
           COUNT(*) as total_p1,
           SUM(CASE WHEN fabricante = 'ABBOTT' THEN 1 ELSE 0 END) as abbott_p1
    FROM eci.sos
    WHERE pagina = 1 AND fecha = '${TARGET_DATE}'
    GROUP BY retail ORDER BY retail
  `)
  const dbSos = {}
  for (const r of dbRows) dbSos[r.retail] = { total: Number(r.total_p1), abbott: Number(r.abbott_p1) }

  // Compare
  console.log("FINAL COMPARISON: xlsx vs DB for " + TARGET_DATE)
  console.log("=" .repeat(90))
  console.log(`${'Retail'.padEnd(25)} ${'Src'.padEnd(5)} ${'Total'.padStart(6)} ${'Abbott'.padStart(7)} ${'SOS %'.padStart(8)}   Notes`)
  console.log("-".repeat(90))
  
  for (const [xlsxName, dbName] of Object.entries(RETAIL_MAP)) {
    const x = xlsxSos[xlsxName] || { total: 0, abbott: 0 }
    const d = dbSos[dbName] || { total: 0, abbott: 0 }
    const xSos = x.total ? ((x.abbott / x.total) * 100).toFixed(2) : '0.00'
    const dSos = d.total ? ((d.abbott / d.total) * 100).toFixed(2) : '0.00'
    const totalDiff = d.total - x.total
    const abbottDiff = d.abbott - x.abbott
    
    let note = ''
    if (x.total === d.total && x.abbott === d.abbott) note = '✓ PERFECT'
    else if (Math.abs(parseFloat(xSos) - parseFloat(dSos)) < 2) note = '≈ CLOSE'
    else note = `⚠ total:${totalDiff>0?'+':''}${totalDiff}, abbott:${abbottDiff>0?'+':''}${abbottDiff}`

    console.log(`${dbName.padEnd(25)} XLSX ${String(x.total).padStart(6)} ${String(x.abbott).padStart(7)} ${xSos.padStart(7)}%`)
    console.log(`${''.padEnd(25)} DB   ${String(d.total).padStart(6)} ${String(d.abbott).padStart(7)} ${dSos.padStart(7)}%   ${note}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
