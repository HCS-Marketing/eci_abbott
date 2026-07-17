import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function withServerlessPoolParams(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl

  try {
    const url = new URL(rawUrl)
    // In Vercel/serverless each instance can open its own pool; keep it tiny to avoid
    // hitting Postgres max connections when many lambdas run at once.
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1")
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "30")
    }
    return url.toString()
  } catch {
    const hasQuery = rawUrl.includes("?")
    const hasConnectionLimit = /(?:^|[?&])connection_limit=/.test(rawUrl)
    const hasPoolTimeout = /(?:^|[?&])pool_timeout=/.test(rawUrl)

    let next = rawUrl
    if (!hasConnectionLimit) {
      next += `${hasQuery ? "&" : "?"}connection_limit=1`
    }
    if (!hasPoolTimeout) {
      next += `${next.includes("?") ? "&" : "?"}pool_timeout=30`
    }
    return next
  }
}

export const prisma =
  (() => {
    const nextDbUrl = withServerlessPoolParams(process.env.DATABASE_URL)
    if (nextDbUrl && process.env.DATABASE_URL !== nextDbUrl) {
      process.env.DATABASE_URL = nextDbUrl
    }

    return globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
      })
  })()

globalForPrisma.prisma = prisma
