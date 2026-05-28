const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const dbInfo = await p.$queryRawUnsafe("SELECT current_database() as db_name, current_user as db_user")
  console.log('DATABASE NAME:', dbInfo[0].db_name)
  console.log('DATABASE USER:', dbInfo[0].db_user)

  const schemas = await p.$queryRawUnsafe("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast')")
  console.log('SCHEMAS:', schemas.map(s => s.schema_name))

  const tables = await p.$queryRawUnsafe("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema','pg_catalog','pg_toast') ORDER BY table_schema, table_name")
  console.log('\nTABLES:')
  tables.forEach(t => console.log('  ' + t.table_schema + '.' + t.table_name))

  // Check eci.sos columns
  const cols = await p.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='eci' AND table_name='sos' ORDER BY ordinal_position")
  console.log('\neci.sos COLUMNS:')
  cols.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'))

  // Check row count
  const count = await p.$queryRawUnsafe("SELECT COUNT(*)::text as n FROM eci.sos")
  console.log('\nROW COUNT:', count[0].n)

  // Check date range
  const dates = await p.$queryRawUnsafe("SELECT MIN(fecha)::text as min_d, MAX(fecha)::text as max_d FROM eci.sos")
  console.log('DATE RANGE:', dates[0])

  // Sample row
  const sample = await p.$queryRawUnsafe("SELECT * FROM eci.sos LIMIT 1")
  console.log('\nSAMPLE:', JSON.stringify(sample[0], null, 2))

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
