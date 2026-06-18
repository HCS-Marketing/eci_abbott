const { Client } = require('pg');
const fs = require('fs');
const DB = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="([^"]+)"/)?.[1];
(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();
  const { rows } = await c.query(`
    SELECT pais, retail, categoria, SUM(n)::bigint AS rows FROM (
      SELECT pais, retail, categoria, COUNT(*)::int AS n FROM eci.sos    GROUP BY pais, retail, categoria
      UNION ALL
      SELECT pais, retail, categoria, COUNT(*)::int AS n FROM eci.search GROUP BY pais, retail, categoria
    ) z
    GROUP BY pais, retail, categoria
    ORDER BY pais, retail, rows DESC
  `);
  let cur = '';
  for (const r of rows) {
    const key = `${r.pais} / ${r.retail}`;
    if (key !== cur) { console.log(`\n--- ${key} ---`); cur = key; }
    console.log(`  ${String(r.rows).padStart(10)}  ${JSON.stringify(r.categoria)}`);
  }
  await c.end();
})();
