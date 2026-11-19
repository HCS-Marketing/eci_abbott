import type Anthropic from "@anthropic-ai/sdk"
import { runReadonlySql, SqlValidationError } from "@/lib/ai/readonly-sql"

// ─── Contexto que el servidor fija por request (Claude no lo puede cambiar) ───
export interface ToolContext {
  country: string        // país efectivo, ya validado contra el lock del usuario
  baseUrl: string        // origen del request, para llamar a /api/sos y /api/provider
  cookie: string         // cookie de sesión del usuario (el middleware la exige)
  requestId: string
}

const TOOL_TIMEOUT_MS = 15_000

// Acciones de /api/sos que Claude puede usar. El país NO es un parámetro del tool:
// lo agrega siempre el servidor.
const SOS_ACTIONS = [
  "dates", "channels", "categories", "subcategories",
  "pricing", "bestsellers", "ranking", "buybox", "buybox_lost", "assortment", "price_index",
  "sellers", "brands", "sellers_list", "segmentos", "mercados",
] as const

// Inventario sale de los archivos de proveedores (/api/provider): solo MX y CO.
const PROVIDER_ACTIONS = ["inventory"] as const

type QueryAction = typeof SOS_ACTIONS[number] | typeof PROVIDER_ACTIONS[number]
const ALL_ACTIONS: readonly QueryAction[] = [...SOS_ACTIONS, ...PROVIDER_ACTIONS]

export const AI_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "query_dashboard_data",
    description:
      "Consulta los mismos datos que muestran los módulos del dashboard (Pricing Live, Ranking, BuyBox, Inventario, Price Index, SOS, etc.). " +
      "Los resultados ya vienen filtrados por el país activo del usuario; no hay parámetro de país. " +
      "Usá 'dates' o 'channels' primero si no sabés qué fecha o retail están disponibles. Preferí esta herramienta antes que SQL.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [...ALL_ACTIONS],
          description:
            "dates = rango de fechas; channels = retails; categories/subcategories = categorías; " +
            "pricing = precios actuales por producto (con seller y fabricante); bestsellers/ranking = productos por posición; " +
            "buybox / buybox_lost = BuyBox (solo MX); assortment = cobertura de catálogo; price_index = índice de precio Abbott vs competencia; " +
            "sellers = share of search por fabricante; brands = share por marca; sellers_list = fabricantes disponibles; " +
            "segmentos / mercados = segmentación (solo MX); inventory = stock por producto y retail (solo MX y CO).",
        },
        date: { type: "string", description: "Fecha YYYY-MM-DD. Si se omite se usa la más reciente cuando aplica." },
        start_date: { type: "string", description: "Inicio de rango YYYY-MM-DD (para acciones de share/ranking)." },
        end_date: { type: "string", description: "Fin de rango YYYY-MM-DD." },
        channel: { type: "string", description: "Retail exacto, ej. 'AMAZON', 'MERCADO LIBRE'. Omitir para todos." },
        category: { type: "string", description: "Categoría exacta (ver 'categories'). Omitir para todas." },
        fabricante: { type: "string", description: "Fabricante exacto (ej. 'ABBOTT'). Omitir para todos." },
        limit: { type: "number", description: "Máximo de filas (default 50, máx 200)." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    name: "run_readonly_sql",
    description:
      "Ejecuta un SELECT de PostgreSQL de solo lectura cuando query_dashboard_data no alcanza (agregaciones, comparaciones, tendencias). " +
      "Tablas disponibles (ya filtradas al país activo; no uses prefijo de esquema):\n" +
      "- sos: una fila por producto observado en una búsqueda/retail/fecha. Columnas: fecha (timestamp), retail, titulo, ean, marca, fabricante, seller, " +
      "categoria, subcategoria, subcategoria_1, categoria_col, subcategoria_col, precio_venta, precio_neto, descuento, promocion, ranking (posición), orden, pagina, " +
      "en_stock (bool), promocionado (bool), envio_gratis (bool), cuotas_sin_interes, reviews, valoracion, ventas, url_producto, presentacion, id, skuid, meli_id.\n" +
      "- search: igual que sos pero sin seller/valoracion/ventas, con la columna search (término buscado).\n" +
      "- marca_fabricante: marca, fabricante, segmento, mercado.\n" +
      "Notas: 'MARCA LOCAL' en fabricante es ruido, excluilo. Abbott puede aparecer como 'ABBOTT' o variantes: usá UPPER(fabricante) LIKE '%ABBOT%'. " +
      "Filtrá siempre por fecha (ej. fecha::date = 'YYYY-MM-DD') porque las tablas son grandes. Devuelve máx 200 filas: resumí con GROUP BY. " +
      "Una sola sentencia, sin ';' ni comentarios.",
    input_schema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "Consulta SELECT (o WITH ... SELECT)." },
        purpose: { type: "string", description: "Qué querés averiguar con esta consulta, en una frase." },
      },
      required: ["sql", "purpose"],
      additionalProperties: false,
    },
  },
]

// ─── Validación de inputs ─────────────────────────────────────────────────────
function str(v: unknown, max = 120): string | undefined {
  if (v == null) return undefined
  const s = String(v).trim()
  if (!s) return undefined
  if (s.length > max) throw new Error(`Valor demasiado largo: ${s.slice(0, 30)}...`)
  return s
}

function isoDate(v: unknown, field: string): string | undefined {
  const s = str(v, 10)
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${field} debe tener formato YYYY-MM-DD`)
  return s
}

async function fetchJson(url: string, ctx: ToolContext): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TOOL_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { cookie: ctx.cookie }, signal: ctrl.signal, cache: "no-store" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const type = res.headers.get("content-type") || ""
    if (!type.includes("application/json")) throw new Error("respuesta no JSON (¿sesión vencida?)")
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function queryDashboardData(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const action = String(input.action || "") as QueryAction
  if (!ALL_ACTIONS.includes(action)) throw new Error(`Acción inválida: ${action}`)

  const date = isoDate(input.date, "date")
  const startDate = isoDate(input.start_date, "start_date")
  const endDate = isoDate(input.end_date, "end_date")
  const channel = str(input.channel)
  const category = str(input.category)
  const fabricante = str(input.fabricante)
  const limitRaw = Number(input.limit ?? 50)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 200)) : 50

  const isProvider = (PROVIDER_ACTIONS as readonly string[]).includes(action)
  if (isProvider && ctx.country !== "MX" && ctx.country !== "CO") {
    return `El inventario solo está disponible para MX y CO; el país activo es ${ctx.country}.`
  }

  const p = new URLSearchParams({ action, limit: String(limit) })
  p.set("country", ctx.country) // siempre lo fija el servidor
  if (date) p.set("date", date)
  if (startDate || date) p.set("startDate", startDate || date!)
  if (endDate || date) p.set("endDate", endDate || date!)
  if (channel) p.set("channel", channel)
  if (category) p.set("category", category)
  if (fabricante) p.set("seller", fabricante)
  if (isProvider) p.set("source", "provider")

  const path = isProvider ? "/api/provider" : "/api/sos"
  const data = await fetchJson(`${ctx.baseUrl}${path}?${p}`, ctx)

  if (Array.isArray(data)) {
    if (data.length === 0) return `Sin resultados para ${action} (país ${ctx.country}) con esos filtros.`
    const rows = data.slice(0, limit)
    const body = JSON.stringify(rows)
    const capped = body.length > 30_000 ? body.slice(0, 30_000) + "…(cortado)" : body
    return `${action} · país ${ctx.country} · ${rows.length} de ${data.length} filas\n${capped}`
  }
  const body = JSON.stringify(data)
  return `${action} · país ${ctx.country}\n${body.length > 30_000 ? body.slice(0, 30_000) + "…(cortado)" : body}`
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export interface ToolRunResult {
  content: string
  isError: boolean
  summary: string // descripción corta para mostrar en la UI
}

export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolRunResult> {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const started = Date.now()
  let summary = name
  try {
    if (name === "query_dashboard_data") {
      summary = `Datos: ${String(args.action || "?")}${args.channel ? ` · ${args.channel}` : ""}${args.date ? ` · ${args.date}` : ""}`
      const content = await queryDashboardData(args, ctx)
      log(ctx, name, "ok", started)
      return { content, isError: false, summary }
    }
    if (name === "run_readonly_sql") {
      summary = `SQL: ${str(args.purpose, 200) || "consulta"}`
      const content = await runReadonlySql(String(args.sql || ""), ctx.country)
      log(ctx, name, "ok", started)
      return { content, isError: false, summary }
    }
    return { content: `Herramienta desconocida: ${name}`, isError: true, summary }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log(ctx, name, "error", started, msg)
    const hint = e instanceof SqlValidationError ? " Corregí la consulta y probá de nuevo." : ""
    return { content: `Error: ${msg}.${hint}`, isError: true, summary }
  }
}

function log(ctx: ToolContext, tool: string, status: string, started: number, error?: string) {
  console.info(JSON.stringify({
    type: "ai_tool", request_id: ctx.requestId, tool, status, country: ctx.country,
    duration_ms: Date.now() - started, ...(error ? { error } : {}),
  }))
}
