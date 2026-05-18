const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const tables = await p.$queryRawUnsafe(
    `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name`
  );
  console.log('=== TABLES ===');
  tables.forEach(x => console.log(x.table_schema + '.' + x.table_name));

  // Check columns in eci schema tables
  const cols = await p.$queryRawUnsafe(
    `SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name, ordinal_position`
  );
  console.log('\n=== COLUMNS ===');
  let lastTable = '';
  cols.forEach(x => {
    const t = x.table_schema + '.' + x.table_name;
    if (t !== lastTable) { console.log('\n-- ' + t + ' --'); lastTable = t; }
    console.log('  ' + x.column_name + ' (' + x.data_type + ')');
  });
}
main().catch(e => console.error(e.message)).finally(() => p.$disconnect());
