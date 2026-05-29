const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Check if there's a real primary key or unique constraint
  const pk = await p.$queryRawUnsafe(`
    SELECT a.attname, i.indisprimary, i.indisunique
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'eci.sos'::regclass
    ORDER BY i.indisprimary DESC, i.indisunique DESC
  `)
  console.log('Indexes on eci.sos:')
  console.table(pk)

  // Check if (id, fecha) is unique per retail/category
  const dups = await p.$queryRawUnsafe(`
    SELECT id, fecha, categoria, COUNT(*) AS cnt
    FROM eci.sos
    WHERE retail = 'FARMACIA DEL AHORRO' AND pais = 'MX' AND fecha::date = '2026-05-26'
    GROUP BY id, fecha, categoria
    HAVING COUNT(*) > 1
    LIMIT 5
  `)
  console.log('\nDuplicate (id, fecha, categoria) for FDA 2026-05-26:')
  console.table(dups)

  // Check if there's an oid or serial column
  const serial = await p.$queryRawUnsafe(`
    SELECT column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'eci' AND table_name = 'sos' AND column_default LIKE '%seq%'
  `)
  console.log('\nSerial/sequence columns:')
  console.table(serial)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
