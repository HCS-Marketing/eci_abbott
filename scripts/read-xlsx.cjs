const XLSX = require('xlsx')
const path = require('path')

// Read latest Peru file
const dir = "G:\\.shortcut-targets-by-id\\1-L071oTvKPJY-lVRZOyAYxUiplTpPE7v\\HCSMKT\\Abbot\\SOS\\basesFinales\\Perú"
const fs = require('fs')
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx')).sort()
const latest = files[files.length - 1]
console.log('Reading:', latest)

const wb = XLSX.readFile(path.join(dir, latest))
console.log('Sheets:', wb.SheetNames)

const ws = wb.Sheets[wb.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(ws, { range: 0 })
console.log('\nColumns:', Object.keys(data[0] || {}))
console.log('\nRow count:', data.length)
console.log('\nFirst 3 rows:')
data.slice(0, 3).forEach(r => console.log(JSON.stringify(r, null, 2)))

// Check fabricante values
const fabs = new Set()
data.forEach(r => { if (r.fabricante || r.Fabricante) fabs.add(r.fabricante || r.Fabricante) })
console.log('\nSample fabricantes:', [...fabs].slice(0, 20))

// Check retailers
const retails = new Set()
data.forEach(r => { if (r.retail || r.Retail) retails.add(r.retail || r.Retail) })
console.log('\nRetailers:', [...retails])
