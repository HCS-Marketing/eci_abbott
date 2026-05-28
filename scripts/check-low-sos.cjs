const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

const BASE = "G:\\.shortcut-targets-by-id\\1-L071oTvKPJY-lVRZOyAYxUiplTpPE7v\\HCSMKT\\Abbot\\SOS\\basesFinales"

// Retailers of interest (low page 1 SOS)
const TARGET_RETAILERS = ["inkafarma", "mifarma", "mercadolibre", "cruz verde"]

function analyzeCountry(countryDir, countryName) {
  const fullDir = path.join(BASE, countryDir)
  if (!fs.existsSync(fullDir)) { console.log(`  [SKIP] ${countryDir} not found`); return }
  
  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.xlsx')).sort()
  if (!files.length) { console.log(`  [SKIP] No xlsx in ${countryDir}`); return }
  
  // Read latest file
  const latest = files[files.length - 1]
  console.log(`\n${"=".repeat(60)}`)
  console.log(`${countryName} — ${latest}`)
  console.log("=".repeat(60))
  
  const wb = XLSX.readFile(path.join(fullDir, latest))
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
  
  console.log(`Total rows: ${data.length}`)
  console.log(`Columns: ${Object.keys(data[0] || {}).join(', ')}`)
  
  // Get all retailers
  const retailers = {}
  data.forEach(r => {
    const retail = (r.retail || r.Retail || "").toString().trim()
    if (!retailers[retail]) retailers[retail] = { total: 0, page1: 0, withMarca: 0, withFabricante: 0, marcas: {}, fabricantes: {} }
    retailers[retail].total++
    const pagina = Number(r['Página'] || r['Pagina'] || r['página'] || r['pagina'] || 0)
    if (pagina === 1) retailers[retail].page1++
    
    const marca = (r.marca || r.Marca || "").toString().trim()
    if (marca) {
      retailers[retail].withMarca++
      retailers[retail].marcas[marca] = (retailers[retail].marcas[marca] || 0) + 1
    }
    
    const fab = (r.fabricante || r.Fabricante || "").toString().trim()
    if (fab) {
      retailers[retail].withFabricante++
      retailers[retail].fabricantes[fab] = (retailers[retail].fabricantes[fab] || 0) + 1
    }
  })
  
  // Show summary for each retailer
  console.log(`\nRetailers found: ${Object.keys(retailers).join(', ')}`)
  
  for (const [retail, info] of Object.entries(retailers)) {
    const isTarget = TARGET_RETAILERS.some(t => retail.toLowerCase().includes(t))
    const marker = isTarget ? " *** LOW SOS ***" : ""
    
    console.log(`\n  ${retail}${marker}`)
    console.log(`    Total rows: ${info.total}, Page 1 rows: ${info.page1}`)
    console.log(`    With marca: ${info.withMarca} (${((info.withMarca/info.total)*100).toFixed(1)}%)`)
    console.log(`    With fabricante: ${info.withFabricante} (${((info.withFabricante/info.total)*100).toFixed(1)}%)`)
    
    if (isTarget) {
      // Show page 1 breakdown
      const page1Rows = data.filter(r => {
        const rt = (r.retail || r.Retail || "").toString().trim()
        const pg = Number(r['Página'] || r['Pagina'] || r['página'] || r['pagina'] || 0)
        return rt === retail && pg === 1
      })
      
      const p1Marcas = {}
      const p1NoMarca = []
      page1Rows.forEach(r => {
        const m = (r.marca || r.Marca || "").toString().trim()
        if (m) p1Marcas[m] = (p1Marcas[m] || 0) + 1
        else p1NoMarca.push((r.titulo || r.Titulo || "").substring(0, 60))
      })
      
      console.log(`    --- Page 1 breakdown (${page1Rows.length} items) ---`)
      const sorted = Object.entries(p1Marcas).sort((a, b) => b[1] - a[1])
      sorted.forEach(([m, c]) => {
        const isAbbott = m.toUpperCase().includes('ABBOT') || 
          ['PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE', 'ELECARE', 'ISOMIL'].includes(m.toUpperCase())
        console.log(`      ${m}: ${c} items${isAbbott ? ' [ABBOTT]' : ''}`)
      })
      if (p1NoMarca.length) {
        console.log(`      [NO MARCA]: ${p1NoMarca.length} items`)
        p1NoMarca.slice(0, 5).forEach(t => console.log(`        - ${t}`))
      }
      
      // Abbott share on page 1
      const abbottBrands = ['PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE', 'ELECARE', 'ISOMIL', 'ABBOTT']
      const abbottP1 = page1Rows.filter(r => {
        const m = (r.marca || r.Marca || "").toString().trim().toUpperCase()
        return m.includes('ABBOT') || abbottBrands.includes(m)
      }).length
      
      console.log(`    => Abbott page 1 SOS: ${page1Rows.length ? ((abbottP1/page1Rows.length)*100).toFixed(2) : 0}% (${abbottP1}/${page1Rows.length})`)
    }
  }
}

// Also check Colombia
function listColombiaFiles() {
  const colDir = path.join(BASE, "Colombia")
  if (!fs.existsSync(colDir)) { console.log("Colombia dir not found"); return }
  const items = fs.readdirSync(colDir)
  console.log("\nColombia dir contents:", items.filter(i => !i.startsWith('.')).slice(0, 10))
}

analyzeCountry("Perú", "PERU")
analyzeCountry("Colombia", "COLOMBIA")
analyzeCountry("Mexico", "MEXICO")
listColombiaFiles()
