import fs from "node:fs"
import path from "node:path"
import * as XLSX from "xlsx"
import fallbackRowsJson from "@/data/mx-provider-rows.json"

const XLSX_API: {
  readFile: (path: string) => { SheetNames: string[]; Sheets: Record<string, unknown> }
  utils: { sheet_to_json: <T>(sheet: unknown, opts?: Record<string, unknown>) => T[] }
  SSF: { parse_date_code: (v: number) => { y: number; m: number; d: number } | null }
} = ((XLSX as unknown as { default?: unknown }).default ?? XLSX) as unknown as {
  readFile: (path: string) => { SheetNames: string[]; Sheets: Record<string, unknown> }
  utils: { sheet_to_json: <T>(sheet: unknown, opts?: Record<string, unknown>) => T[] }
  SSF: { parse_date_code: (v: number) => { y: number; m: number; d: number } | null }
}

export interface MxProviderRow {
  fecha: string
  retail: string
  titulo: string
  ean: string
  categoria: string
  posicion: number | null
  seller: string
  ventas: number
  valoracion: number
  reviews: number
  img_count: number
  video_count: number
  bullet_points: number
  title_count_characters: number
  count_character_desc: number
  url_producto: string
  disponibilidad: string
  disponible: boolean
}

function hasProviderBase(root: string): boolean {
  return fs.existsSync(path.join(root, "base_prov", "amz")) && fs.existsSync(path.join(root, "base_prov", "ml"))
}

function candidateRoots(): string[] {
  const c = [
    process.cwd(),
    process.env.INIT_CWD || "",
    process.env.PWD || "",
  ].filter(Boolean)

  try {
    if (typeof __dirname === "string" && __dirname) c.push(__dirname)
  } catch {
    // Ignore environments where __dirname is unavailable
  }

  const out: string[] = []
  const seen = new Set<string>()
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

function resolveProviderBaseDir(): string {
  for (const root of candidateRoots()) {
    if (hasProviderBase(root)) return path.join(root, "base_prov")
  }

  return path.join(process.cwd(), "base_prov")
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX_API.SSF.parse_date_code(value)
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
      return d.toISOString().slice(0, 10)
    }
  }

  const str = String(value ?? "").trim()
  if (!str) return null

  const asNum = Number(str)
  if (Number.isFinite(asNum) && String(asNum) === str) {
    const parsed = XLSX_API.SSF.parse_date_code(asNum)
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
      return d.toISOString().slice(0, 10)
    }
  }

  const d = new Date(str)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

function normalizeRetail(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase()
  if (!raw) return ""
  if (raw === "ML" || raw.includes("MERCADO")) return "MERCADO LIBRE"
  if (raw.includes("AMAZON")) return "AMAZON"
  return raw
}

function parseVentas(value: unknown): number {
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

function parseValoracion(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(5, value))
  }
  const raw = String(value ?? "").trim().replace(",", ".")
  if (!raw || raw === "-") return 0
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(5, n))
}

function parseIntegerField(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value))
  const raw = String(value ?? "").trim()
  if (!raw || raw === "-") return 0
  const digits = raw.replace(/\D/g, "")
  if (!digits) return 0
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function normalizeHeaderKey(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function readField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key]
  }

  const normalizedTargets = new Set(keys.map(normalizeHeaderKey))
  for (const [rowKey, rowValue] of Object.entries(row)) {
    if (normalizedTargets.has(normalizeHeaderKey(rowKey))) return rowValue
  }

  return undefined
}

function normalizeDisponibilidad(value: unknown): { disponibilidad: string; disponible: boolean } {
  const raw = String(value ?? "").trim().toUpperCase()
  if (raw.includes("NO")) return { disponibilidad: "NO DISPONIBLE", disponible: false }
  return { disponibilidad: "DISPONIBLE", disponible: true }
}

function parsePosicion(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value)
  const n = Number.parseInt(String(value ?? "").trim(), 10)
  return Number.isFinite(n) ? n : null
}

function readExcelFilesFromDir(dirPath: string): MxProviderRow[] {
  if (!fs.existsSync(dirPath)) return []
  const fileNames = fs.readdirSync(dirPath)
    .filter(f => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"))

  const rows: MxProviderRow[] = []

  for (const fileName of fileNames) {
    const fullPath = path.join(dirPath, fileName)
    const wb = XLSX_API.readFile(fullPath)
    const sheetName = wb.SheetNames[0]
    if (!sheetName) continue

    const ws = wb.Sheets[sheetName]
    const data = XLSX_API.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })

    for (const r of data) {
      const fecha = normalizeDate(r.fecha)
      const retail = normalizeRetail(r.retail)
      const titulo = String(r.titulo ?? "").trim()
      if (!fecha || !retail || !titulo) continue

      const ean = String(readField(r, ["EAN", "ean", "Ean"]) ?? "").trim()
      const categoria = String(readField(r, ["categoria", "Categoría", "CATEGORIA", "category", "Category"]) ?? "").trim()
      const bulletPoints = parseIntegerField(readField(r, ["bullet_points", "bullet point", "bullet_points_count", "bullet_count", "bullets", "bulletpoints"]))

      const { disponibilidad, disponible } = normalizeDisponibilidad(r.disponibilidad)
      rows.push({
        fecha,
        retail,
        titulo,
        ean,
        categoria,
        posicion: parsePosicion(r.posicion),
        seller: String(r.seller ?? "").trim() || "SIN INFORMACION",
        ventas: parseVentas(r.ventas),
        valoracion: parseValoracion(r.valoracion),
        reviews: parseIntegerField(r.reviews),
        img_count: parseIntegerField(r.img_count),
        video_count: parseIntegerField(r.video_count),
        bullet_points: bulletPoints,
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

export function loadMxProviderRows(): MxProviderRow[] {
  const baseDir = resolveProviderBaseDir()
  const all = [
    ...readExcelFilesFromDir(path.join(baseDir, "amz")),
    ...readExcelFilesFromDir(path.join(baseDir, "ml")),
  ]
  const fallbackRows = (fallbackRowsJson as unknown as MxProviderRow[]) || []
  const base = (all.length > 0 ? all : fallbackRows).map(r => ({
    ...r,
    ean: String(r.ean || "").trim(),
    categoria: String(r.categoria || "").trim(),
    bullet_points: Number(r.bullet_points || 0),
  }))
  base.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
    if (a.retail !== b.retail) return a.retail.localeCompare(b.retail)
    return a.titulo.localeCompare(b.titulo, "es")
  })
  return base
}

export function maxMxProviderDate(rows: MxProviderRow[]): string {
  return rows.reduce((max, r) => (r.fecha > max ? r.fecha : max), "")
}

export function minMxProviderDate(rows: MxProviderRow[]): string {
  return rows.reduce((min, r) => (!min || r.fecha < min ? r.fecha : min), "")
}

export function toProviderSkuid(row: MxProviderRow, idx: number): string {
  const base = `${row.retail}|${row.titulo}`
  const hash = Array.from(base).reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) >>> 0, 7)
  const pos = row.posicion ?? idx + 1
  return `${row.retail}-${pos}-${hash.toString(16)}`
}
