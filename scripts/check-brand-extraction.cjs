const XLSX = require('xlsx')
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const DB = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').match(/DATABASE_URL="([^"]+)"/)?.[1]

async function main() {
  const c = new Client({ connectionString: DB })
  await c.connect()

  // Get all known marca → fabricante mappings
  const mfRes = await c.query('SELECT DISTINCT marca, fabricante FROM eci.marca_fabricante ORDER BY fabricante, marca')
  console.log(`\nTotal known marca entries: ${mfRes.rows.length}`)
  mfRes.rows.forEach(r => console.log(`  ${r.fabricante.padEnd(25)} | ${r.marca}`))

  // Show titles with null marca from the sample file
  const file = String.raw`G:\.shortcut-targets-by-id\1-L071oTvKPJY-lVRZOyAYxUiplTpPE7v\HCSMKT\Abbot\SOS\basesFinales\Mexico\ConsolidadoSOS_2026-06-11.xlsx`
  const wb = XLSX.readFile(file, { cellDates: false, raw: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })

  const nullMarca = rows.filter(r => !r.marca)
  console.log(`\nTitles with null marca (${nullMarca.length} rows):`)
  const uniqueTitulos = [...new Set(nullMarca.map(r => r.titulo))]
  uniqueTitulos.slice(0, 30).forEach(t => console.log(`  ${t}`))

  await c.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
