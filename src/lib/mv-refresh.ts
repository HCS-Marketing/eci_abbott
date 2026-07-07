import type { PrismaClient } from "@prisma/client"

type RefreshConfig = {
  cacheKey: string
  baseMaxDateSql: string
  mvMaxDateSql: string
  refreshViews: string[]
  minCheckIntervalMs?: number
}

type RefreshState = {
  checkedAt: number
  refreshing?: Promise<void>
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

const globalState = globalThis as unknown as {
  __mvRefreshState?: Record<string, RefreshState>
}

const stateByKey: Record<string, RefreshState> = globalState.__mvRefreshState ?? {}
globalState.__mvRefreshState = stateByKey

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

export async function ensureMaterializedViewsFresh(prisma: PrismaClient, cfg: RefreshConfig): Promise<void> {
  const now = Date.now()
  const minInterval = cfg.minCheckIntervalMs ?? DEFAULT_INTERVAL_MS
  const st = stateByKey[cfg.cacheKey] ?? { checkedAt: 0 }
  stateByKey[cfg.cacheKey] = st

  if (st.refreshing) {
    await st.refreshing
    return
  }
  if (now - st.checkedAt < minInterval) return

  st.refreshing = (async () => {
    try {
      const [baseMax, mvMax] = await Promise.all([
        queryMaxDate(prisma, cfg.baseMaxDateSql),
        queryMaxDate(prisma, cfg.mvMaxDateSql),
      ])

      if (baseMax && (!mvMax || mvMax < baseMax)) {
        for (const mv of cfg.refreshViews) {
          await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW ${mv}`)
        }
      }
      st.checkedAt = Date.now()
    } catch {
      // Keep APIs resilient; next requests will retry after interval.
      st.checkedAt = Date.now()
    } finally {
      st.refreshing = undefined
    }
  })()

  await st.refreshing
}

export async function ensureSosMaterializedViewsFresh(prisma: PrismaClient): Promise<void> {
  await ensureMaterializedViewsFresh(prisma, {
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
  })
}

export async function ensureSearchMaterializedViewsFresh(prisma: PrismaClient): Promise<void> {
  await ensureMaterializedViewsFresh(prisma, {
    cacheKey: "search",
    baseMaxDateSql: `SELECT MAX(fecha) AS max_d FROM eci.search WHERE search IS NOT NULL AND TRIM(search) <> ''`,
    mvMaxDateSql: `SELECT MAX(fecha) AS max_d FROM eci.mv_search_daily_fab`,
    refreshViews: [
      "eci.mv_search_daily_fab",
      "eci.mv_search_daily_marca",
    ],
  })
}
