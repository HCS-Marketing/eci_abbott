import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const DEFAULT_CONNECTION_LIMIT = process.env.PRISMA_CONNECTION_LIMIT || "1"
const DEFAULT_POOL_TIMEOUT = process.env.PRISMA_POOL_TIMEOUT || "15"

function withServerlessPoolParams(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl

  try {
    const url = new URL(rawUrl)
    // In Vercel/serverless each instance can open its own pool; keep it tiny to avoid
    // hitting Postgres max connections when many lambdas run at once.
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", DEFAULT_CONNECTION_LIMIT)
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", DEFAULT_POOL_TIMEOUT)
    }
    return url.toString()
  } catch {
    const hasQuery = rawUrl.includes("?")
    const hasConnectionLimit = /(?:^|[?&])connection_limit=/.test(rawUrl)
    const hasPoolTimeout = /(?:^|[?&])pool_timeout=/.test(rawUrl)

    let next = rawUrl
    if (!hasConnectionLimit) {
      next += `${hasQuery ? "&" : "?"}connection_limit=${DEFAULT_CONNECTION_LIMIT}`
    }
    if (!hasPoolTimeout) {
      next += `${next.includes("?") ? "&" : "?"}pool_timeout=${DEFAULT_POOL_TIMEOUT}`
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
        // Vercel serverless timeout es 300s por defecto, set Prisma timeouts
        errorFormat: "pretty",
      })
  })()

globalForPrisma.prisma = prisma
