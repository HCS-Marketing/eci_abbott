import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function isTruthyPromotedSql(columnSql = "promocionado") {
  return `LOWER(TRIM(${columnSql}::text)) IN ('true', 't', '1', 'si', 'sí', 'yes', 'y')`
}

function countryCondition(params: unknown[], country: string): string {
  const normalized = String(country || "CO").trim().toUpperCase()
  const aliases = normalized === "CO" || normalized === "COL" || normalized === "COLOMBIA"
    ? ["CO", "COL", "COLOMBIA"]
    : [normalized]
  const start = params.length + 1
  params.push(...aliases)
  return ` AND UPPER(TRIM(pais)) IN (${aliases.map((_, idx) => `$${start + idx}`).join(", ")})`
}

function dateRangeCondition(params: unknown[], startDate: string, endDate: string): string {
  if (startDate) {
    params.push(new Date(`${startDate}T00:00:00Z`))
  } else {
    params.push(new Date("2000-01-01T00:00:00Z"))
  }
  if (endDate) {
    params.push(new Date(`${endDate}T23:59:59Z`))
  } else {
    params.push(new Date("2099-12-31T23:59:59Z"))
  }
  return ` AND fecha >= $${params.length - 1} AND fecha <= $${params.length}`
}

function channelCondition(params: unknown[], channel: string): string {
  if (!channel) return ""
  params.push(channel)
  return ` AND retail = $${params.length}`
}

function categoryCondition(params: unknown[], category: string): string {
  if (!category) return ""
  params.push(category)
  return ` AND NULLIF(TRIM(categoria_col), '') = $${params.length}`
}

function sourceCondition(source: string): string[] {
  if (source === "sos") return ["sos"]
  if (source === "search") return ["search"]
  return ["sos", "search"]
}

async function tableColumns(tableName: "sos" | "search"): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'eci' AND table_name = $1`,
    tableName
  )
  return new Set(rows.map(row => row.column_name))
}

function titleExpression(columns: Set<string>, preferred: string[]): string {
  const parts = preferred
    .filter(column => columns.has(column))
    .map(column => `NULLIF(TRIM(${column}), '')`)
  if (parts.length === 0) return `''`
  return `COALESCE(${parts.join(", ")})`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action") || "summary"
  const country = searchParams.get("country") || "CO"
  const channel = searchParams.get("channel") || ""
  const category = searchParams.get("category") || ""
  const source = searchParams.get("source") || "all"
  const startDate = searchParams.get("startDate") || searchParams.get("date") || ""
  const endDate = searchParams.get("endDate") || searchParams.get("date") || ""
  const limit = Math.min(5000, Number.parseInt(searchParams.get("limit") || "500", 10))

  if (String(country).trim().toUpperCase() !== "CO") {
    return NextResponse.json(action === "rows" ? [] : { rows: [], totals: {} })
  }

  try {
    if (action === "dates") {
      const sql = `
        SELECT MIN(fecha) AS min_d, MAX(fecha) AS max_d
        FROM (
          SELECT fecha FROM eci.sos WHERE ${isTruthyPromotedSql("promocionado")}
          UNION ALL
          SELECT fecha FROM eci.search WHERE ${isTruthyPromotedSql("promocionado")}
        ) d
      `
      const [row] = await prisma.$queryRawUnsafe<{ min_d: Date | null; max_d: Date | null }[]>(sql)
      return NextResponse.json({
        min: row?.min_d?.toISOString().slice(0, 10) || "",
        max: row?.max_d?.toISOString().slice(0, 10) || "",
      })
    }

    if (action === "channels") {
      const params: unknown[] = []
      const dateSql = dateRangeCondition(params, startDate, endDate)
      const countrySql = countryCondition(params, country)
      const sql = `
        SELECT DISTINCT retail AS n
        FROM (
          SELECT fecha, pais, retail FROM eci.sos WHERE ${isTruthyPromotedSql("promocionado")}
          UNION ALL
          SELECT fecha, pais, retail FROM eci.search WHERE ${isTruthyPromotedSql("promocionado")}
        ) d
        WHERE retail IS NOT NULL AND TRIM(retail) <> '' ${dateSql} ${countrySql}
        ORDER BY 1
      `
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...params)
      return NextResponse.json(rows.map(r => r.n))
    }

    if (action === "categories") {
      const params: unknown[] = []
      const dateSql = dateRangeCondition(params, startDate, endDate)
      const countrySql = countryCondition(params, country)
      const channelSql = channelCondition(params, channel)
      const sql = `
        SELECT DISTINCT categoria_col AS n
        FROM (
          SELECT fecha, pais, retail, categoria_col FROM eci.sos WHERE ${isTruthyPromotedSql("promocionado")}
          UNION ALL
          SELECT fecha, pais, retail, categoria_col FROM eci.search WHERE ${isTruthyPromotedSql("promocionado")}
        ) d
        WHERE categoria_col IS NOT NULL AND TRIM(categoria_col) <> '' ${dateSql} ${countrySql} ${channelSql}
        ORDER BY 1
      `
      const rows = await prisma.$queryRawUnsafe<{ n: string }[]>(sql, ...params)
      return NextResponse.json(rows.map(r => r.n))
    }

    const selectedSources = sourceCondition(source)
    const [sosColumns, searchColumns] = await Promise.all([
      selectedSources.includes("sos") ? tableColumns("sos") : Promise.resolve(new Set<string>()),
      selectedSources.includes("search") ? tableColumns("search") : Promise.resolve(new Set<string>()),
    ])
    const sosTitleSql = titleExpression(sosColumns, ["titulo", "producto", "id"])
    const searchTitleSql = titleExpression(searchColumns, ["titulo", "producto", "id", "search"])
    const unionParts: string[] = []
    const params: unknown[] = []

    const sosWhere = [
      isTruthyPromotedSql("promocionado"),
      "fecha IS NOT NULL",
      "retail IS NOT NULL",
    ]
    const searchWhere = [...sosWhere]

    const baseDateSql = dateRangeCondition(params, startDate, endDate)
    const baseCountrySql = countryCondition(params, country)
    const baseChannelSql = channelCondition(params, channel)
    const baseCategorySql = categoryCondition(params, category)

    if (selectedSources.includes("sos")) {
      unionParts.push(`
        SELECT
          'sos' AS fuente,
          'PLP Categoria' AS formato,
          fecha::date AS fecha,
          retail,
          NULLIF(TRIM(categoria_col), '') AS categoria_col,
          NULLIF(TRIM(subcategoria_col), '') AS subcategoria_col,
          ${sosTitleSql} AS titulo,
          NULLIF(TRIM(marca), '') AS marca,
          CASE WHEN UPPER(COALESCE(fabricante, '')) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(NULLIF(TRIM(fabricante), ''), 'MARCA LOCAL') END AS fabricante,
          NULLIF(TRIM(orden::text), '')::numeric AS orden,
          ${isTruthyPromotedSql("promocionado")} AS promocionado
        FROM eci.sos
        WHERE ${sosWhere.join(" AND ")} ${baseDateSql} ${baseCountrySql} ${baseChannelSql} ${baseCategorySql}
      `)
    }

    if (selectedSources.includes("search")) {
      unionParts.push(`
        SELECT
          'search' AS fuente,
          'Sponsored Search' AS formato,
          fecha::date AS fecha,
          retail,
          NULLIF(TRIM(categoria_col), '') AS categoria_col,
          NULLIF(TRIM(subcategoria_col), '') AS subcategoria_col,
          ${searchTitleSql} AS titulo,
          NULLIF(TRIM(marca), '') AS marca,
          CASE WHEN UPPER(COALESCE(fabricante, '')) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(NULLIF(TRIM(fabricante), ''), 'MARCA LOCAL') END AS fabricante,
          NULLIF(TRIM(orden::text), '')::numeric AS orden,
          ${isTruthyPromotedSql("promocionado")} AS promocionado
        FROM eci.search
        WHERE ${searchWhere.join(" AND ")} ${baseDateSql} ${baseCountrySql} ${baseChannelSql} ${baseCategorySql}
      `)
    }

    const baseSql = unionParts.join(" UNION ALL ")

    if (action === "rows") {
      const sql = `
        SELECT *
        FROM (${baseSql}) promoted
        ORDER BY fecha DESC, retail, fuente, orden ASC NULLS LAST, titulo
        LIMIT ${limit}
      `
      const rows = await prisma.$queryRawUnsafe(sql, ...params)
      return NextResponse.json(rows)
    }

    const summarySql = `
      WITH promoted AS (${baseSql})
      SELECT
        COUNT(*)::int AS total_promocionados,
        COUNT(*) FILTER (WHERE fabricante = 'ABBOTT')::int AS abbott_promocionados,
        COUNT(*) FILTER (WHERE fabricante <> 'ABBOTT')::int AS competencia_promocionados,
        COUNT(DISTINCT retail)::int AS retailers,
        COUNT(DISTINCT categoria_col)::int AS categorias,
        ROUND(AVG(orden)::numeric, 2)::float AS orden_promedio
      FROM promoted
    `
    const byRetailSql = `
      WITH promoted AS (${baseSql})
      SELECT retail, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE fabricante = 'ABBOTT')::int AS abbott, COUNT(*) FILTER (WHERE fabricante <> 'ABBOTT')::int AS competencia, ROUND(AVG(orden)::numeric, 2)::float AS orden_promedio
      FROM promoted
      GROUP BY retail
      ORDER BY total DESC, retail
    `
    const byFormatSql = `
      WITH promoted AS (${baseSql})
      SELECT formato, fuente, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE fabricante = 'ABBOTT')::int AS abbott, COUNT(*) FILTER (WHERE fabricante <> 'ABBOTT')::int AS competencia, ROUND(AVG(orden)::numeric, 2)::float AS orden_promedio
      FROM promoted
      GROUP BY formato, fuente
      ORDER BY total DESC
    `
    const byCompetitorSql = `
      WITH promoted AS (${baseSql})
      SELECT fabricante, marca, COUNT(*)::int AS total, ROUND(AVG(orden)::numeric, 2)::float AS orden_promedio
      FROM promoted
      WHERE fabricante <> 'ABBOTT'
      GROUP BY fabricante, marca
      ORDER BY total DESC, orden_promedio ASC NULLS LAST
      LIMIT 50
    `
    const [summaryRows, retailRows, formatRows, competitorRows] = await Promise.all([
      prisma.$queryRawUnsafe(summarySql, ...params),
      prisma.$queryRawUnsafe(byRetailSql, ...params),
      prisma.$queryRawUnsafe(byFormatSql, ...params),
      prisma.$queryRawUnsafe(byCompetitorSql, ...params),
    ])

    return NextResponse.json({
      totals: Array.isArray(summaryRows) ? summaryRows[0] || {} : {},
      byRetail: retailRows,
      byFormat: formatRows,
      competitors: competitorRows,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
