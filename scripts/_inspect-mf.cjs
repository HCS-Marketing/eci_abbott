const { Client } = require('pg');
const fs = require('fs');
const DB = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="([^"]+)"/)?.[1];
(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();
  const { rows: cols } = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='eci' AND table_name='marca_fabricante'
    ORDER BY ordinal_position
  `);
  console.log('Columns:', cols);
  const { rows: cons } = await c.query(`
    SELECT conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='eci' AND t.relname='marca_fabricante'
  `);
  console.log('Constraints:', cons);
  await c.end();
})();
