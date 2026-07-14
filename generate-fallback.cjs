const fs = require("fs")
const path = require("path")
const XLSX = require("xlsx")

console.log("📦 Generating fallback data from Excel files...")

const amzPath = path.join(__dirname, "base_prov", "amz", "amz_abbott_2026-07-14.xlsx")
const mlPath = path.join(__dirname, "base_prov", "ml", "ml_abbott_2026-07-14.xlsx")

const rows = []

for (const filePath of [amzPath, mlPath]) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`)
    continue
  }

  console.log(`📄 Reading: ${path.basename(filePath)}`)
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(ws, { defval: "" })

  for (const r of data) {
    rows.push({
      fecha: String(r.fecha || "").trim(),
      retail: String(r.retail || "").toUpperCase().trim(),
      titulo: String(r.titulo || "").trim(),
      ean: String(r.EAN || "").trim(),
      categoria: String(r.categoria || "").trim(),
      posicion: Number(r.posicion || 0),
      seller: String(r.seller || "").trim(),
      ventas: Number(r.ventas || 0),
      valoracion: Number(r.valoracion || 0),
      reviews: Number(r.reviews || 0),
      img_count: Number(r.img_count || 0),
      video_count: Number(r.video_count || 0),
      bullet_points: Number(r.bullet_points || 0),
      title_count_characters: Number(r.title_count_characters || 0),
      count_character_desc: Number(r.count_character_desc || 0),
      url_producto: String(r.url_producto || "").trim(),
      disponibilidad: String(r.disponibilidad || "").trim(),
      disponible: String(r.disponibilidad || "").toUpperCase().includes("DISPONIBLE")
    })
  }
}

console.log(`\n✅ Loaded ${rows.length} rows`)
console.log(`   Rows with EAN: ${rows.filter(r => r.ean).length}`)
console.log(`   Rows with categoria: ${rows.filter(r => r.categoria).length}`)
console.log(`   Unique categories: ${[...new Set(rows.map(r => r.categoria).filter(Boolean))].join(", ")}`)

const outputPath = path.join(__dirname, "src", "data", "mx-provider-rows.json")
fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2))
console.log(`\n💾 Saved to: ${outputPath}`)
