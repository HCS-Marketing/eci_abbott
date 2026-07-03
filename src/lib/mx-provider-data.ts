import fs from "node:fs"
import path from "node:path"
import XLSX from "xlsx"

export interface MxProviderRow {
  fecha: string
  retail: string
  titulo: string
  posicion: number | null
  seller: string
  ventas: number
  valoracion: number
  disponibilidad: string
  disponible: boolean
}

const AMZ_DIR = path.join(process.cwd(), "base_prov", "amz")
const ML_DIR = path.join(process.cwd(), "base_prov", "ml")

function normalizeDate(value: unknown): string | null {
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
  if (!str) return null

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
    const wb = XLSX.readFile(fullPath)
    const sheetName = wb.SheetNames[0]
    if (!sheetName) continue

    const ws = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })

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
        disponibilidad,
        disponible,
      })
    }
  }

  return rows
}

export function loadMxProviderRows(): MxProviderRow[] {
  const all = [...readExcelFilesFromDir(AMZ_DIR), ...readExcelFilesFromDir(ML_DIR)]
  all.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
    if (a.retail !== b.retail) return a.retail.localeCompare(b.retail)
    return a.titulo.localeCompare(b.titulo, "es")
  })
  return all
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
