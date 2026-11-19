import { PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"

// SQL de solo lectura para el asistente de IA.
//
// Capas de seguridad (todas se aplican siempre):
//  1. Validación estática: una sola sentencia SELECT/WITH, sin comentarios, sin
//     placeholders, sin referencias a esquemas ni a catálogos del sistema.
//  2. Las tablas visibles son CTEs que ya vienen filtradas por país
//     (sos, search, marca_fabricante). search_path = pg_catalog, así que
//     cualquier otra tabla sin calificar no existe.
//  3. Transacción READ ONLY con statement_timeout.
//  4. Si AI_READONLY_DATABASE_URL está definida, se usa esa conexión
//     (recomendado: un usuario de Postgres con permisos solo de SELECT).

const MAX_ROWS = 200
const STATEMENT_TIMEOUT_MS = 20_000
const MAX_RESULT_CHARS = 30_000
const MAX_SQL_CHARS = 6_000

let readonlyClient: PrismaClient | null = null
function getClient(): PrismaClient {
  const url = process.env.AI_READONLY_DATABASE_URL
  if (!url) return prisma
  if (!readonlyClient) readonlyClient = new PrismaClient({ datasourceUrl: url })
  return readonlyClient
}

const FORBIDDEN_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /;/, reason: "solo se permite una sentencia (sin ';')" },
  { re: /--|\/\*/, reason: "no se permiten comentarios" },
  { re: /\$\d/, reason: "no se permiten placeholders ($1)" },
  { re: /\b(eci|public|information_schema|pg_catalog|pg_temp\w*|pg_toast)\b/i, reason: "no se permiten esquemas; usá las tablas sos, search y marca_fabricante" },
  { re: /\bpg_\w+/i, reason: "no se permiten funciones ni tablas del sistema" },
  {
    re: /\b(insert|update|delete|merge|drop|alter|create|grant|revoke|truncate|copy|call|do|execute|prepare|deallocate|lock|vacuum|analyze|cluster|reindex|refresh|comment|security|set|reset|listen|notify|unlisten|discard|checkpoint|load|import)\b/i,
    reason: "solo se permiten consultas SELECT",
  },
  { re: /\b(set_config|current_setting|dblink\w*|lo_\w+|query_to_xml\w*|table_to_xml\w*|cursor_to_xml\w*|txid_\w+|inet_\w+)\b/i, reason: "función no permitida" },
  { re: /\binto\b/i, reason: "SELECT INTO no está permitido" },
  { re: /\bfor\s+(update|share|no\s+key\s+update|key\s+share)\b/i, reason: "bloqueos de filas no permitidos" },
]

export class SqlValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SqlValidationError"
  }
}

export function validateReadonlySql(raw: string): string {
  let sql = String(raw || "").trim()
  // Permitir un ';' final y quitarlo
  sql = sql.replace(/;\s*$/, "").trim()
  if (!sql) throw new SqlValidationError("La consulta está vacía")
  if (sql.length > MAX_SQL_CHARS) throw new SqlValidationError(`La consulta supera ${MAX_SQL_CHARS} caracteres`)
  if (!/^(select|with)\b/i.test(sql)) throw new SqlValidationError("La consulta debe empezar con SELECT o WITH")
  for (const { re, reason } of FORBIDDEN_PATTERNS) {
    if (re.test(sql)) throw new SqlValidationError(`Consulta rechazada: ${reason}`)
  }
  return sql
}

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === "bigint") return Number(value)
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber() // Prisma Decimal
  }
  return value
}

/**
 * Ejecuta un SELECT de solo lectura. Las tablas `sos`, `search` y `marca_fabricante`
 * están restringidas al país indicado; el SQL de Claude no puede ver otros países.
 */
export async function runReadonlySql(rawSql: string, countryCode: string): Promise<string> {
  const sql = validateReadonlySql(rawSql)
  const country = String(countryCode || "").trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) throw new SqlValidationError("País inválido")

  const wrapped = `
    WITH
      sos AS NOT MATERIALIZED (SELECT * FROM eci.sos WHERE UPPER(TRIM(pais)) = $1),
      search AS NOT MATERIALIZED (SELECT * FROM eci.search WHERE UPPER(TRIM(pais)) = $1),
      marca_fabricante AS NOT MATERIALIZED (
        SELECT * FROM eci.marca_fabricante WHERE pais IS NULL OR UPPER(TRIM(pais)) = $1
      )
    SELECT * FROM (
${sql}
    ) AS _q
    LIMIT ${MAX_ROWS + 1}
  `

  const client = getClient()
  const rows = await client.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY")
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    await tx.$executeRawUnsafe("SET LOCAL search_path TO pg_catalog")
    return tx.$queryRawUnsafe<Record<string, unknown>[]>(wrapped, country)
  }, { maxWait: 5_000, timeout: STATEMENT_TIMEOUT_MS + 5_000 })

  const truncatedRows = rows.length > MAX_ROWS
  const visible = truncatedRows ? rows.slice(0, MAX_ROWS) : rows
  let body = JSON.stringify(visible, jsonReplacer)
  let truncatedChars = false
  if (body.length > MAX_RESULT_CHARS) {
    body = body.slice(0, MAX_RESULT_CHARS)
    truncatedChars = true
  }

  const notes: string[] = [`${visible.length} filas (país ${country})`]
  if (truncatedRows) notes.push(`resultado cortado en ${MAX_ROWS} filas: agregá GROUP BY / filtros para resumir`)
  if (truncatedChars) notes.push("salida cortada por tamaño: seleccioná menos columnas")
  return `${notes.join(" · ")}\n${body}`
}
