const fs = require("node:fs")
const path = require("node:path")
const XLSX = require("xlsx")

const ROOT = process.cwd()
const AMZ_DIR = path.join(ROOT, "base_prov", "amz")
const ML_DIR = path.join(ROOT, "base_prov", "ml")
const OUTPUT_FILE = path.join(ROOT, "src", "data", "mx-provider-rows.json")

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
      return d.toISOString().slice(0, 10)
    }
  }

  const str = String(value ?? "").trim()
  if (!str) return ""

  const asNum = Number(str)
  if (Number.isFinite(asNum) && String(asNum) === str) {
    const parsed = XLSX.SSF.parse_date_code(asNum)
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
      return d.toISOString().slice(0, 10)
    }
  }

  const d = new Date(str)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return ""
}

function normalizeRetail(value) {
  const raw = String(value ?? "").trim().toUpperCase()
  if (!raw) return ""
  if (raw === "ML" || raw.includes("MERCADO")) return "MERCADO LIBRE"
  if (raw.includes("AMAZON")) return "AMAZON"
  return raw
}

function parseVentas(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value)
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw || raw === "-") return 0

  const km = raw.match(/(\d+(?:[.,]\d+)?)\s*k/)
  if (km) {
    const n = Number.parseFloat(km[1].replace(",", "."))
    return Number.isFinite(n) ? Math.round(n * 1000) : 0
  }

  const m = raw.match(/(\d+(?:[.,]\d+)?)/)
  if (!m) return 0
  const n = Number.parseFloat(m[1].replace(",", "."))
  return Number.isFinite(n) ? Math.round(n) : 0
}

function parseValoracion(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(5, value))
  }
  const raw = String(value ?? "").trim().replace(",", ".")
  if (!raw || raw === "-") return 0
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(5, n))
}

function parsePosicion(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value)
  const n = Number.parseInt(String(value ?? "").trim(), 10)
  return Number.isFinite(n) ? n : null
}

function parseIntegerField(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value))
  const raw = String(value ?? "").trim()
  if (!raw || raw === "-") return 0
  const digits = raw.replace(/\D/g, "")
  if (!digits) return 0
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function normalizeDisponibilidad(value) {
  const raw = String(value ?? "").trim().toUpperCase()
  if (raw.includes("NO")) return { disponibilidad: "NO DISPONIBLE", disponible: false }
  return { disponibilidad: "DISPONIBLE", disponible: true }
}

function readExcelFilesFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) return []

  const fileNames = fs.readdirSync(dirPath)
    .filter(f => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"))

  const rows = []

  for (const fileName of fileNames) {
    const fullPath = path.join(dirPath, fileName)
    const wb = XLSX.readFile(fullPath)
    const sheetName = wb.SheetNames[0]
    if (!sheetName) continue

    const ws = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { defval: "" })

    for (const r of data) {
      const fecha = normalizeDate(r.fecha)
      const retail = normalizeRetail(r.retail)
      const titulo = String(r.titulo ?? "").trim()
      if (!fecha || !retail || !titulo) continue

      const { disponibilidad, disponible } = normalizeDisponibilidad(r.disponibilidad)
      rows.push({
        fecha,
        retail,
        titulo,
        posicion: parsePosicion(r.posicion),
        seller: String(r.seller ?? "").trim() || "SIN INFORMACION",
        ventas: parseVentas(r.ventas),
        valoracion: parseValoracion(r.valoracion),
        reviews: parseIntegerField(r.reviews),
        img_count: parseIntegerField(r.img_count),
        video_count: parseIntegerField(r.video_count),
        title_count_characters: parseIntegerField(r.title_count_characters),
        count_character_desc: parseIntegerField(r.count_character_desc),
        url_producto: String(r.url_producto ?? "").trim(),
        disponibilidad,
        disponible,
      })
    }
  }

  return rows
}

function main() {
  const rows = [
    ...readExcelFilesFromDir(AMZ_DIR),
    ...readExcelFilesFromDir(ML_DIR),
  ]

  if (rows.length === 0) {
    console.warn("[refresh-provider-json] No se encontraron filas válidas en Excel. Se conserva el JSON actual.")
    return
  }

  rows.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
    if (a.retail !== b.retail) return a.retail.localeCompare(b.retail)
    return a.titulo.localeCompare(b.titulo, "es")
  })

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(rows, null, 2))

  const minDate = rows[0].fecha
  const maxDate = rows[rows.length - 1].fecha
  console.log(`[refresh-provider-json] rows=${rows.length} min=${minDate} max=${maxDate}`)
}

main()
