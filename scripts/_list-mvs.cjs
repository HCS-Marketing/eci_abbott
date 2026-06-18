const { Client } = require('pg');
const fs = require('fs');
const DB = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="([^"]+)"/)?.[1];
(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();
  const r = await c.query(`SELECT schemaname||'.'||matviewname AS mv FROM pg_matviews WHERE schemaname='eci' ORDER BY 1`);
  console.log(r.rows.map(x => x.mv).join('\n'));
  await c.end();
})();
