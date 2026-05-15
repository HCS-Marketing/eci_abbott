import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL + "&connection_limit=5&pool_timeout=10",
      },
    },
  })

// Always cache globally — prevents connection exhaustion in serverless/HMR
globalForPrisma.prisma = prisma
