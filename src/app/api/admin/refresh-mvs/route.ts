import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  refreshMaterializedViewsNow,
  SEARCH_MV_REFRESH_CONFIG,
  SOS_MV_REFRESH_CONFIG,
} from "@/lib/mv-refresh"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type RefreshModule = "sos" | "search" | "all"

function isAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== "production" && !process.env.REFRESH_MVS_TOKEN) return true

  const expected = process.env.REFRESH_MVS_TOKEN || process.env.CRON_SECRET
  if (!expected) return false

  const auth = req.headers.get("authorization") || ""
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  const headerToken = req.headers.get("x-refresh-token") || ""

  return bearer === expected || headerToken === expected
}

function parseModule(req: Request): RefreshModule {
  const { searchParams } = new URL(req.url)
  const moduleParam = (searchParams.get("module") || "all").toLowerCase()
  if (moduleParam === "sos" || moduleParam === "search") return moduleParam
  return "all"
}

async function handleRefresh(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const moduleName = parseModule(req)
  const force = searchParams.get("force") === "true"
  const startedAt = Date.now()

  const modules = moduleName === "all"
    ? [
        ["sos", SOS_MV_REFRESH_CONFIG] as const,
        ["search", SEARCH_MV_REFRESH_CONFIG] as const,
      ]
    : [[moduleName, moduleName === "sos" ? SOS_MV_REFRESH_CONFIG : SEARCH_MV_REFRESH_CONFIG] as const]

  const results = []
  for (const [name, config] of modules) {
    results.push({
      module: name,
      ...(await refreshMaterializedViewsNow(prisma, config, { force })),
    })
  }

  const failed = results.some(r => r.results.some(v => !v.refreshed))

  return NextResponse.json({
    ok: !failed,
    module: moduleName,
    force,
    durationMs: Date.now() - startedAt,
    results,
  }, { status: failed ? 207 : 200 })
}

export async function GET(req: Request) {
  return handleRefresh(req)
}

export async function POST(req: Request) {
  return handleRefresh(req)
}
