const XLSX = require('xlsx')

const file = 'G:\\.shortcut-targets-by-id\\1-L071oTvKPJY-lVRZOyAYxUiplTpPE7v\\HCSMKT\\Abbot\\SOS\\basesFinales\\Mexico\\ConsolidadoSOS_2026-06-11.xlsx'
const wb = XLSX.readFile(file, { cellDates: false, raw: true })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
const nullMarca = rows.filter(r => !r.marca)
const unique = [...new Set(nullMarca.map(r => r.titulo))]
console.log('Null marca count:', nullMarca.length, '/', rows.length)
console.log('\nUnique titles without marca (first 30):')
unique.slice(0, 30).forEach(t => console.log(' ', t))
