const fs = require("fs")
const path = require("path")
const XLSX = require("xlsx")

function normalizeHeaderKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function readField(row, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key]
  }

  const normalizedTargets = new Set(keys.map(normalizeHeaderKey))
  for (const [rowKey, rowValue] of Object.entries(row)) {
    if (normalizedTargets.has(normalizeHeaderKey(rowKey))) return rowValue
  }

  return undefined
}

function hasProviderBase(root) {
  return fs.existsSync(path.join(root, "base_prov", "amz")) && fs.existsSync(path.join(root, "base_prov", "ml"))
}

function candidateRoots() {
  const c = [
    process.cwd(),
    process.env.INIT_CWD || "",
    process.env.PWD || "",
  ].filter(Boolean)

  if (typeof __dirname === "string" && __dirname) c.push(__dirname)

  const out = []
  const seen = new Set()
  for (const start of c) {
    let cur = path.resolve(start)
    while (true) {
      if (!seen.has(cur)) {
        seen.add(cur)
        out.push(cur)
      }
      const parent = path.dirname(cur)
      if (parent === cur) break
      cur = parent
    }
  }

  return out
}

function resolveProviderBaseDir() {
  for (const root of candidateRoots()) {
    if (hasProviderBase(root)) return path.join(root, "base_prov")
  }

  return path.join(process.cwd(), "base_prov")
}

function readExcelFilesFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`⚠️  Directory not found: ${dirPath}`)
    return []
  }
  
  const fileNames = fs.readdirSync(dirPath)
    .filter(f => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"))

  console.log(`📂 Found ${fileNames.length} Excel files in ${dirPath}`)

  const rows = []

  for (const fileName of fileNames) {
    const fullPath = path.join(dirPath, fileName)
    console.log(`📄 Reading: ${fileName}`)
    const wb = XLSX.readFile(fullPath)
    const sheetName = wb.SheetNames[0]
    if (!sheetName) continue

    const ws = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { defval: "" })

    for (const r of data) {
      const ean = String(readField(r, ["EAN", "ean", "Ean"]) ?? "").trim()
      const categoria = String(readField(r, ["categoria", "Categoría", "CATEGORIA", "category", "Category"]) ?? "").trim()
      
      rows.push({
        titulo: String(r.titulo ?? "").trim(),
        ean,
        categoria,
      })
    }
  }

  return rows
}

// Main execution
console.log("🔍 Diagnosing EAN and Category loading...\n")

const baseDir = resolveProviderBaseDir()
console.log(`✅ Resolved base_prov directory: ${baseDir}\n`)

const all = [
  ...readExcelFilesFromDir(path.join(baseDir, "amz")),
  ...readExcelFilesFromDir(path.join(baseDir, "ml")),
]

console.log(`\n📊 Total rows loaded: ${all.length}`)

const withEAN = all.filter(r => r.ean).length
const withCat = all.filter(r => r.categoria).length

console.log(`✅ Rows with EAN: ${withEAN}`)
console.log(`✅ Rows with categoria: ${withCat}`)

const cats = [...new Set(all.map(r => r.categoria).filter(Boolean))]
console.log(`\n📋 Unique categories (${cats.length}):`)
cats.forEach(c => console.log(`   - ${c}`))

console.log(`\n📝 Sample rows with data:`)
const samples = all.filter(r => r.ean && r.categoria).slice(0, 3)
samples.forEach((s, i) => {
  console.log(`\n${i + 1}. Titulo: ${s.titulo.substring(0, 60)}...`)
  console.log(`   EAN: ${s.ean}`)
  console.log(`   Categoria: ${s.categoria}`)
})
