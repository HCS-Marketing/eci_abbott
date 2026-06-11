import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// db.prisma.io is Prisma Postgres (managed pooler) — no need to set connection_limit.
// pool_timeout=30 prevents premature failures when many dashboard fetches run in parallel.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL + "&pool_timeout=30",
      },
    },
  })

globalForPrisma.prisma = prisma
