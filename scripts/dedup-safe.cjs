const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  console.log('=== DEDUP: Removing true duplicates by (fecha, retail, id, categoria, pagina, orden) ===')
  console.log('Only removing rows that are FULLY identical (titulo+marca+fabricante+precio_venta match)\n')

  // Use ROW_NUMBER to identify duplicates, delete those with rn > 1
  const result = await p.$queryRawUnsafe(`
    DELETE FROM eci.sos
    WHERE ctid IN (
      SELECT ctid FROM (
        SELECT ctid,
          ROW_NUMBER() OVER (
            PARTITION BY fecha, retail, id, categoria, pagina, orden, titulo, marca, fabricante, precio_venta
            ORDER BY ctid
          ) AS rn
        FROM eci.sos
      ) sub
      WHERE rn > 1
    )
  `)
  console.log('Done!')

  // Verify
  const count = await p.$queryRawUnsafe('SELECT COUNT(*) as n FROM eci.sos')
  console.log('Total rows after dedup:', Number(count[0].n))

  // Check remaining duplicates
  const remaining = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as groups, SUM(cnt-1) as extra FROM (
      SELECT fecha, retail, id, categoria, pagina, orden, COUNT(*) as cnt
      FROM eci.sos
      GROUP BY fecha, retail, id, categoria, pagina, orden
      HAVING COUNT(*) > 1
    ) sub
  `)
  console.log('Remaining dup groups (same key, different data):', Number(remaining[0].groups))
  console.log('Remaining extra rows:', Number(remaining[0].extra))
}

main().catch(console.error).finally(() => p.$disconnect())
