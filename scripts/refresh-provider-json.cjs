const fs = require("node:fs")
const path = require("node:path")
const XLSX = require("xlsx")

const ROOT = process.cwd()
const PROVIDER_CONFIGS = [
  {
    label: "mx",
    baseDir: "base_prov",
    dirs: ["amz", "ml", "heb", "sams"],
    outputFile: path.join(ROOT, "src", "data", "mx-provider-rows.json"),
    retailByDir: {},
  },
  {
    label: "co",
    baseDir: "base_prov_co",
    dirs: ["cruz_verde", "farmatodo", "larebaja", "rappi", "unidroga"],
    outputFile: path.join(ROOT, "src", "data", "co-provider-rows.json"),
    retailByDir: {
      cruz_verde: "CRUZ VERDE",
      farmatodo: "FARMATODO",
      larebaja: "LA REBAJA",
      rappi: "RAPPI",
      unidroga: "UNIDROGA",
    },
  },
]

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
  if (raw === "SAMS" || raw.includes("SAM'S") || raw.includes("SAMS CLUB")) return "SAMS CLUB"
  if (raw === "HEB" || raw.includes("H-E-B")) return "HEB"
  return raw
}

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

function readTextField(row, keys) {
  return String(readField(row, keys) ?? "").trim()
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

function readExcelFilesFromDir(dirPath, retailOverride = "") {
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
      const fecha = normalizeDate(readField(r, ["fecha"]))
      const retail = retailOverride || normalizeRetail(readField(r, ["retail"]))
      const titulo = readTextField(r, ["titulo"])
      if (!fecha || !retail || !titulo) continue

      const { disponibilidad, disponible } = normalizeDisponibilidad(readField(r, ["disponibilidad"]))
      rows.push({
        fecha,
        retail,
        titulo,
        ean: readTextField(r, ["EAN", "ean"]),
        categoria: readTextField(r, ["categoria", "categoría"]),
        posicion: parsePosicion(readField(r, ["posicion", "posición"])),
        seller: readTextField(r, ["seller"]) || "SIN INFORMACION",
        ventas: parseVentas(readField(r, ["ventas"])),
        valoracion: parseValoracion(readField(r, ["valoracion", "valoración"])),
        reviews: parseIntegerField(readField(r, ["reviews"])),
        img_count: parseIntegerField(readField(r, ["img_count"])),
        video_count: parseIntegerField(readField(r, ["video_count"])),
        bullet_points: parseIntegerField(readField(r, ["bullet_points"])),
        title_count_characters: parseIntegerField(readField(r, ["title_count_characters"])),
        count_character_desc: parseIntegerField(readField(r, ["count_character_desc"])),
        description: readTextField(r, ["description", "descripcion", "descripción"]),
        url_imagen: readTextField(r, ["url_imagen", "image_url", "imagen", "image"]),
        url_producto: readTextField(r, ["url_producto"]),
        disponibilidad,
        disponible,
      })
    }
  }

  return rows
}

function refreshProviderJson(config) {
  const rows = config.dirs.flatMap(dir => readExcelFilesFromDir(
    path.join(ROOT, config.baseDir, dir),
    config.retailByDir[dir] || ""
  ))

  if (rows.length === 0) {
    console.warn(`[refresh-provider-json] ${config.label}: No se encontraron filas válidas en Excel. Se conserva el JSON actual.`)
    return
  }

  rows.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
    if (a.retail !== b.retail) return a.retail.localeCompare(b.retail)
    return a.titulo.localeCompare(b.titulo, "es")
  })

  fs.writeFileSync(config.outputFile, JSON.stringify(rows, null, 2))

  const minDate = rows[0].fecha
  const maxDate = rows[rows.length - 1].fecha
  console.log(`[refresh-provider-json] ${config.label}: rows=${rows.length} min=${minDate} max=${maxDate}`)
}

function main() {
  for (const config of PROVIDER_CONFIGS) refreshProviderJson(config)
}

main()
