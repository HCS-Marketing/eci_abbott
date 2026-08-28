import type { PrismaClient } from "@prisma/client"

type RefreshConfig = {
  cacheKey: string
  baseMaxDateSql: string
  mvMaxDateSql: string
  refreshViews: string[]
  minCheckIntervalMs?: number
}

export type MaterializedViewRefreshResult = {
  view: string
  refreshed: boolean
  method?: "concurrently" | "standard"
  error?: string
}

type RefreshState = {
  checkedAt: number
  refreshing?: Promise<void>
}

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000 // 30 minutos en lugar de 5

const globalState = globalThis as unknown as {
  __mvRefreshState?: Record<string, RefreshState>
}

const stateByKey: Record<string, RefreshState> = globalState.__mvRefreshState ?? {}
globalState.__mvRefreshState = stateByKey

const AUTO_REFRESH_ENABLED = process.env.AUTO_REFRESH_MVS === "true" || process.env.NODE_ENV !== "production"

function toIsoDate(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v)
  return s.length >= 10 ? s.slice(0, 10) : null
}

async function queryMaxDate(prisma: PrismaClient, sql: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ max_d: Date | string | null }[]>(sql)
  return toIsoDate(rows?.[0]?.max_d)
}

async function refreshViews(prisma: PrismaClient, views: string[]): Promise<MaterializedViewRefreshResult[]> {
  const results: MaterializedViewRefreshResult[] = []

  for (const mv of views) {
    try {
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${mv}`)
      results.push({ view: mv, refreshed: true, method: "concurrently" })
    } catch (err) {
      try {
        await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW ${mv}`)
        results.push({ view: mv, refreshed: true, method: "standard" })
      } catch (fallbackErr) {
        const error = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
        console.error(`Failed to refresh ${mv}`, err)
        results.push({ view: mv, refreshed: false, error })
      }
    }
  }

  return results
}

export async function refreshMaterializedViewsNow(
  prisma: PrismaClient,
  cfg: RefreshConfig,
  opts: { force?: boolean } = {}
): Promise<{ baseMax: string | null; mvMax: string | null; skipped: boolean; results: MaterializedViewRefreshResult[] }> {
  const [baseMax, mvMax] = await Promise.all([
    queryMaxDate(prisma, cfg.baseMaxDateSql),
    queryMaxDate(prisma, cfg.mvMaxDateSql),
  ])

  if (!opts.force && (!baseMax || (mvMax && mvMax >= baseMax))) {
    return { baseMax, mvMax, skipped: true, results: [] }
  }

  const results = await refreshViews(prisma, cfg.refreshViews)
  return { baseMax, mvMax, skipped: false, results }
}

export async function ensureMaterializedViewsFresh(prisma: PrismaClient, cfg: RefreshConfig): Promise<void> {
  if (!AUTO_REFRESH_ENABLED) return

  const now = Date.now()
  const minInterval = cfg.minCheckIntervalMs ?? DEFAULT_INTERVAL_MS
  const st = stateByKey[cfg.cacheKey] ?? { checkedAt: 0 }
  stateByKey[cfg.cacheKey] = st

  // Si ya está refrescando, no esperes (para no bloquear el request)
  if (st.refreshing) {
    return
  }
  // Si hace poco se refresheó, no hagas nada
  if (now - st.checkedAt < minInterval) return

  // Inicia el refresh en background sin bloquear
  st.refreshing = (async () => {
    try {
      const [baseMax, mvMax] = await Promise.all([
        queryMaxDate(prisma, cfg.baseMaxDateSql),
        queryMaxDate(prisma, cfg.mvMaxDateSql),
      ])

      if (baseMax && (!mvMax || mvMax < baseMax)) {
        await refreshViews(prisma, cfg.refreshViews)
      }
      st.checkedAt = Date.now()
    } catch (err) {
      // Keep APIs resilient; next requests will retry after interval.
      console.error("MV refresh error:", err)
      st.checkedAt = Date.now()
    } finally {
      st.refreshing = undefined
    }
  })()

  // No esperes el resultado - deja que continue en background
}

export async function ensureSosMaterializedViewsFresh(prisma: PrismaClient): Promise<void> {
  await ensureMaterializedViewsFresh(prisma, SOS_MV_REFRESH_CONFIG)
}

export const SOS_MV_REFRESH_CONFIG: RefreshConfig = {
  cacheKey: "sos",
  baseMaxDateSql: `SELECT MAX(fecha) AS max_d FROM eci.sos`,
  mvMaxDateSql: `SELECT MAX(fecha) AS max_d FROM eci.mv_sos_daily_fab`,
  refreshViews: [
    "eci.mv_sos_daily_fab",
    "eci.mv_sos_daily_marca",
    "eci.mv_sos_daily_titulo",
    "eci.mv_ranking_daily_fab",
    "eci.mv_ranking_daily_marca",
    "eci.mv_ranking_daily_titulo",
    "eci.mv_sos_dimensions",
    "eci.mv_sos_product_latest",
  ],
}

export async function ensureSearchMaterializedViewsFresh(prisma: PrismaClient): Promise<void> {
  await ensureMaterializedViewsFresh(prisma, SEARCH_MV_REFRESH_CONFIG)
}

export const SEARCH_MV_REFRESH_CONFIG: RefreshConfig = {
  cacheKey: "search",
  baseMaxDateSql: `SELECT MAX(fecha) AS max_d FROM eci.search WHERE search IS NOT NULL AND TRIM(search) <> ''`,
  mvMaxDateSql: `SELECT MAX(fecha) AS max_d FROM eci.mv_search_daily_fab`,
  refreshViews: [
    "eci.mv_search_daily_fab",
    "eci.mv_search_daily_marca",
  ],
}
