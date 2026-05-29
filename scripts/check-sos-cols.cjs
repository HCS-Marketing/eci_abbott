const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const cols = await p.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'eci' AND table_name = 'sos'
    ORDER BY ordinal_position
  `)
  console.log("=== eci.sos columns ===")
  console.log(cols.map(c => `${c.column_name} (${c.data_type})`).join('\n'))

  // Sample a row
  const sample = await p.$queryRawUnsafe("SELECT * FROM eci.sos LIMIT 1")
  const keys = Object.keys(sample[0])
  console.log("\n=== Sample keys ===", keys.join(', '))

  await p.$disconnect()
}
main()
