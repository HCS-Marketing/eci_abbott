const XLSX = require('xlsx')
const path = require('path')

const file = String.raw`G:\.shortcut-targets-by-id\1-L071oTvKPJY-lVRZOyAYxUiplTpPE7v\HCSMKT\Abbot\SOS\basesFinales\Mexico\ConsolidadoSOS_2026-06-11.xlsx`

const wb = XLSX.readFile(file, { cellDates: false, raw: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { defval: null })

console.log('Column names:', Object.keys(rows[0]))
console.log('\nFirst 3 rows (key fields):')
rows.slice(0, 3).forEach(r => {
  console.log({
    titulo: r.titulo,
    marca: r.marca,
    fabricante: r.fabricante,
    retail: r.retail,
    categoria: r.categoria,
  })
})

console.log('\nRows with null fabricante:', rows.filter(r => !r.fabricante).length, '/', rows.length)
console.log('Rows with null marca:', rows.filter(r => !r.marca).length, '/', rows.length)
