/**
 * Check xlsx files for Benavides rows with precio_venta=0
 * to see if there's any price data in the original source.
 */
const XLSX = require("xlsx")
const path = require("path")
const fs = require("fs")

const BASE = String.raw`G:\.shortcut-targets-by-id\1-L071oTvKPJY-lVRZOyAYxUiplTpPE7v\HCSMKT\Abbot\SOS\basesFinales\Mexico`

// Pick a recent file
const files = fs.readdirSync(BASE).filter(f => f.endsWith(".xlsx")).sort()
const recent = files[files.length - 1]
console.log("Reading:", recent)

const wb = XLSX.readFile(path.join(BASE, recent))
const ws = wb.Sheets[wb.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(ws)

console.log("Total rows:", data.length)
console.log("Columns:", Object.keys(data[0] || {}).join(", "))

// Find Benavides rows
const bena = data.filter(r => {
  const retail = (r.retail || r.Retail || r.RETAIL || "").toString().toUpperCase()
  return retail.includes("BENAVIDES")
})
console.log("\nBenavides rows:", bena.length)

if (bena.length > 0) {
  // Show first 5 rows with all price-related columns
  const priceCols = Object.keys(bena[0]).filter(k => 
    /precio|price|costo|cost|valor|monto/i.test(k)
  )
  console.log("Price columns found:", priceCols.join(", "))
  
  console.log("\nSample Benavides rows (price columns):")
  bena.slice(0, 10).forEach((r, i) => {
    const vals = {}
    priceCols.forEach(c => vals[c] = r[c])
    // Also include producto/titulo for context
    const nombre = r.titulo || r.producto || r.nombre || r.TITULO || r.PRODUCTO || ""
    console.log(`  [${i}] ${nombre.toString().substring(0, 60)}`)
    console.log(`       `, vals)
  })

  // Count by price value
  const withPrice = bena.filter(r => {
    return priceCols.some(c => r[c] && Number(r[c]) > 0)
  })
  console.log(`\nBenavides rows with ANY price > 0: ${withPrice.length} / ${bena.length}`)
  
  if (withPrice.length > 0) {
    console.log("\nExamples WITH price:")
    withPrice.slice(0, 5).forEach((r, i) => {
      const vals = {}
      priceCols.forEach(c => vals[c] = r[c])
      const nombre = r.titulo || r.producto || r.nombre || r.TITULO || r.PRODUCTO || ""
      console.log(`  [${i}] ${nombre.toString().substring(0, 60)}`)
      console.log(`       `, vals)
    })
  }
}
