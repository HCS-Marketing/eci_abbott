/**
 * Investigates rows where the categoria looks like a brand name (shifted columns).
 * Read-only.
 */
const { Client } = require('pg');
const fs = require('fs');
const DB = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="([^"]+)"/)?.[1];

// Brand-ish tokens that should not be categorias.
const BRAND_CAT_TOKENS = [
  'PEDIASURE','SIMILAC','GLUCERNA','ENSURE','PEDIALYTE','NESTLE','ABBOTT',
  'NESTUM','NIDO','NAN','ENFAMIL','ENFAGROW','NOVAMIL','BLEMIL','NUTRIBEN',
  'GERBER','SUSTAGEN','SUPRADYN','CENTRUM','REDOXON','BABYLAC','SUEROX',
  'PEDILAYTE','BOOST',
];

(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();

  console.log('\n=== Categorias that look like brand names ===\n');
  const conds = BRAND_CAT_TOKENS.map((_, i) => `UPPER(categoria) LIKE $${i+1}`).join(' OR ');
  const params = BRAND_CAT_TOKENS.map(t => `%${t}%`);

  for (const tbl of ['eci.sos', 'eci.search']) {
    console.log(`--- ${tbl} ---`);
    const { rows } = await c.query(
      `SELECT pais, retail, categoria, COUNT(*)::int AS rows,
              MIN(titulo) AS sample_titulo, MIN(marca) AS sample_marca
         FROM ${tbl}
        WHERE categoria IS NOT NULL AND (${conds})
        GROUP BY pais, retail, categoria
        ORDER BY rows DESC
        LIMIT 80`, params);
    console.table(rows);
  }

  // Look at a few sample rows: do the titulo/marca/precio look plausible
  // for the inferred "real" category?
  console.log('\n=== Sample rows for top suspicious categorias ===\n');
  for (const tbl of ['eci.sos', 'eci.search']) {
    const { rows } = await c.query(
      `SELECT pais, retail, categoria, titulo, marca, fabricante, precio_venta, fecha
         FROM ${tbl}
        WHERE UPPER(categoria) IN ('PEDIASURE','SIMILAC','GLUCERNA','ENSURE','PEDIALYTE')
        ORDER BY random() LIMIT 15`);
    console.log(`--- ${tbl} samples ---`);
    console.table(rows);
  }

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
