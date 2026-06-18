// Null out "search-keyword-as-categoria" rows in eci.search.
// These are scraper artifacts where the categoria column holds the search term
// (typically a brand or generic keyword in ALL-CAPS) and the returned products
// are unrelated. Confirmed via samples in diag-brand-as-category.cjs.
//
// Scope: CO/RAPPI and MX/AMAZON only (where samples show clearly unrelated titulos).
// Other retails with brand-named categorias either show coherent products
// (Bucket C: keep) or are legitimate brand-themed landing pages (Bucket A: keep).
const { Client } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const DB = env.match(/DATABASE_URL="?([^"\r\n]+)"?/)?.[1];
if (!DB) { console.error('DATABASE_URL not found in .env.local'); process.exit(1); }

// (pais, retail, categoria) tuples to NULL in eci.search.
const TARGETS = [
  // CO/RAPPI — brand-named
  ['CO', 'RAPPI', 'GLUCERNA'],
  ['CO', 'RAPPI', 'PEDIASURE'],
  ['CO', 'RAPPI', 'ENSURE'],
  ['CO', 'RAPPI', 'PEDIALYTE'],
  ['CO', 'RAPPI', 'SIMILAC'],
  // CO/RAPPI — generic search keywords (same scraper artifact)
  ['CO', 'RAPPI', 'PROTEINA'],
  ['CO', 'RAPPI', 'HIERRO'],
  ['CO', 'RAPPI', 'GLUCOSA'],
  ['CO', 'RAPPI', 'NINOS'],
  ['CO', 'RAPPI', 'DIABETES'],
  ['CO', 'RAPPI', 'SUPLEMENTO'],
  ['CO', 'RAPPI', 'APETITO'],
  ['CO', 'RAPPI', 'CALCIO'],
  ['CO', 'RAPPI', 'SUERO'],
  ['CO', 'RAPPI', 'BIOTINA'],
  ['CO', 'RAPPI', 'FORMULA'],
  ['CO', 'RAPPI', 'DIARREA'],
  ['CO', 'RAPPI', 'HIDRATANTE'],
  ['CO', 'RAPPI', 'CRECIMIENTO'],
  ['CO', 'RAPPI', 'FARMACIA'],
  ['CO', 'RAPPI', 'CUIDADO DEL BEBE'],
  ['CO', 'RAPPI', 'BIENESTAR Y SALUD'],
  ['CO', 'RAPPI', 'SALUD NUTRICIONAL'],
  ['CO', 'RAPPI', 'BEBES'],
  // MX/AMAZON — brand-named + generic keywords (all ~96 rows each, one scraper pass)
  ['MX', 'AMAZON', 'GLUCERNA'],
  ['MX', 'AMAZON', 'PEDIASURE'],
  ['MX', 'AMAZON', 'SIMILAC'],
  ['MX', 'AMAZON', 'PEDIALYTE'],
  ['MX', 'AMAZON', 'ENSURE'],
  ['MX', 'AMAZON', 'PROTEINA'],
  ['MX', 'AMAZON', 'VITAMINAS'],
  ['MX', 'AMAZON', 'SUPLEMENTO NUTRICIONAL'],
  ['MX', 'AMAZON', 'DIABETES SUPLEMENTO'],
  ['MX', 'AMAZON', 'FORMULA LACTEA'],
];

const MV_ORDER = [
  'eci.mv_search_daily_fab',
  'eci.mv_search_daily_marca',
  'eci.mv_search_daily_titulo',
];

(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();
  try {
    // Preview counts per target before mutating
    console.log('Preview (rows that will be nulled):');
    let grandTotal = 0;
    for (const [pais, retail, cat] of TARGETS) {
      const r = await c.query(
        `SELECT COUNT(*)::int AS n FROM eci.search
          WHERE pais = $1 AND retail = $2 AND categoria = $3`,
        [pais, retail, cat]
      );
      const n = r.rows[0].n;
      grandTotal += n;
      if (n > 0) console.log(`  ${pais}/${retail.padEnd(8)}  "${cat}"  ${n}`);
    }
    console.log(`  TOTAL: ${grandTotal}`);

    if (grandTotal === 0) {
      console.log('Nothing to do.');
      await c.end();
      return;
    }

    console.log('\nApplying inside a transaction...');
    await c.query('BEGIN');
    let totalUpdated = 0;
    for (const [pais, retail, cat] of TARGETS) {
      const r = await c.query(
        `UPDATE eci.search
            SET categoria = NULL
          WHERE pais = $1 AND retail = $2 AND categoria = $3`,
        [pais, retail, cat]
      );
      totalUpdated += r.rowCount;
    }
    console.log(`  eci.search rows nulled: ${totalUpdated}`);
    await c.query('COMMIT');
    console.log('Commit OK.');

    console.log('\nRefreshing search materialized views...');
    for (const mv of MV_ORDER) {
      const t = Date.now();
      try {
        await c.query(`REFRESH MATERIALIZED VIEW ${mv}`);
        console.log(`  ${mv}  ok  (${((Date.now() - t) / 1000).toFixed(1)}s)`);
      } catch (e) {
        console.log(`  ${mv}  FAIL: ${e.message}`);
      }
    }
    console.log('\nDone.');
  } catch (e) {
    try { await c.query('ROLLBACK'); console.log('Rolled back:', e.message); } catch {}
    throw e;
  } finally {
    await c.end();
  }
})().catch(e => { console.error(e); process.exit(1); });
