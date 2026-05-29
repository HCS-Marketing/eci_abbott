const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Check table structure
  const cols = await p.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema='eci' AND table_name='marca_fabricante' 
    ORDER BY ordinal_position
  `)
  console.log('=== marca_fabricante columns ===')
  console.table(cols)

  // Check existing data
  const sample = await p.$queryRawUnsafe(`
    SELECT * FROM eci.marca_fabricante LIMIT 5
  `)
  console.log('\n=== Sample rows ===')
  console.table(sample)

  const count = await p.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM eci.marca_fabricante`)
  console.log('\nTotal rows:', count[0].cnt)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
