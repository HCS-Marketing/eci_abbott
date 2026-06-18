/**
 * apply-cleanup.cjs
 *
 * Reads scripts/_cleanup-plan.json and applies it to the live DB.
 *
 *   node scripts/apply-cleanup.cjs --dry            # report what would change
 *   node scripts/apply-cleanup.cjs                  # apply with BEGIN/COMMIT
 *
 * Touches: eci.sos, eci.search, eci.marca_fabricante.
 * After applying, refreshes the materialized views.
 */
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

const DB = fs.readFileSync(
  path.join(__dirname, '..', '.env.local'), 'utf8'
).match(/DATABASE_URL="([^"]+)"/)?.[1];

const PLAN = JSON.parse(
  fs.readFileSync(path.join(__dirname, '_cleanup-plan.json'), 'utf8'),
);

const DRY = process.argv.includes('--dry');

// All MVs are discovered at runtime; this list is just the documented order
// in which to refresh them (some depend on others).
const MV_ORDER = [
  'eci.mv_sos_daily_fab',
  'eci.mv_sos_daily_marca',
  'eci.mv_sos_daily_titulo',
  'eci.mv_search_daily_fab',
  'eci.mv_search_daily_marca',
  'eci.mv_search_daily_titulo',
  'eci.mv_sos_dimensions',
  'eci.mv_sos_product_latest',
  'eci.mv_ranking_daily_fab',
  'eci.mv_ranking_daily_marca',
  'eci.mv_ranking_daily_titulo',
  'eci.brand_daily',
  'eci.categories_timeseries',
  'eci.latest_snapshot',
  'eci.sos_monthly',
];

(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();

  // Build a single batched mapping table inside the transaction.
  const fabPairs = Object.entries(PLAN.fabricantes.map);
  const marPairs = Object.entries(PLAN.marcas.map);
  const catPairs = PLAN.categories.per_retail.flatMap(c =>
    c.variants
      .filter(v => v.cat !== c.canonical)
      .map(v => [c.pais, c.retail, v.cat, c.canonical]),
  );

  console.log(`Fabricantes:  ${fabPairs.length} mappings`);
  console.log(`Marcas:       ${marPairs.length} mappings`);
  console.log(`Categories:   ${catPairs.length} (pais,retail,from,to) mappings`);

  if (DRY) {
    console.log('\n--- dry-run preview ---');
    console.log('First 10 fabricante mappings:');
    for (const [from, to] of fabPairs.slice(0, 10)) console.log(`   ${JSON.stringify(from)} -> ${JSON.stringify(to)}`);
    console.log('First 10 marca mappings:');
    for (const [from, to] of marPairs.slice(0, 10)) console.log(`   ${JSON.stringify(from)} -> ${JSON.stringify(to)}`);
    console.log('First 10 category mappings:');
    for (const [p, r, from, to] of catPairs.slice(0, 10)) console.log(`   [${p}/${r}] ${JSON.stringify(from)} -> ${JSON.stringify(to)}`);
    await c.end();
    return;
  }

  console.log('\nApplying inside a transaction...');
  await c.query('BEGIN');

  try {
    // ─── upload mapping rows into temp tables ─────────────────────
    await c.query(`
      CREATE TEMP TABLE _fab_map(from_v text PRIMARY KEY, to_v text NOT NULL) ON COMMIT DROP;
      CREATE TEMP TABLE _mar_map(from_v text PRIMARY KEY, to_v text NOT NULL) ON COMMIT DROP;
      CREATE TEMP TABLE _cat_map(pais text, retail text, from_v text, to_v text NOT NULL,
                                 PRIMARY KEY(pais, retail, from_v)) ON COMMIT DROP;
    `);

    if (fabPairs.length) {
      const vals = fabPairs.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',');
      const params = fabPairs.flat();
      await c.query(`INSERT INTO _fab_map(from_v,to_v) VALUES ${vals}`, params);
    }
    if (marPairs.length) {
      const vals = marPairs.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',');
      const params = marPairs.flat();
      await c.query(`INSERT INTO _mar_map(from_v,to_v) VALUES ${vals}`, params);
    }
    if (catPairs.length) {
      const vals = catPairs.map((_, i) => `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4})`).join(',');
      const params = catPairs.flat();
      await c.query(`INSERT INTO _cat_map(pais,retail,from_v,to_v) VALUES ${vals}`, params);
    }

    // ─── apply to eci.sos ─────────────────────────────────────────
    let r;
    r = await c.query(`UPDATE eci.sos s SET fabricante = m.to_v
                       FROM _fab_map m WHERE s.fabricante = m.from_v`);
    console.log(`  eci.sos.fabricante: ${r.rowCount} rows updated`);

    r = await c.query(`UPDATE eci.sos s SET marca = m.to_v
                       FROM _mar_map m WHERE s.marca = m.from_v`);
    console.log(`  eci.sos.marca:      ${r.rowCount} rows updated`);

    r = await c.query(`UPDATE eci.sos s SET categoria = m.to_v
                       FROM _cat_map m
                       WHERE s.pais = m.pais AND s.retail = m.retail AND s.categoria = m.from_v`);
    console.log(`  eci.sos.categoria:  ${r.rowCount} rows updated`);

    // ─── apply to eci.search ──────────────────────────────────────
    r = await c.query(`UPDATE eci.search s SET fabricante = m.to_v
                       FROM _fab_map m WHERE s.fabricante = m.from_v`);
    console.log(`  eci.search.fabricante: ${r.rowCount} rows updated`);

    r = await c.query(`UPDATE eci.search s SET marca = m.to_v
                       FROM _mar_map m WHERE s.marca = m.from_v`);
    console.log(`  eci.search.marca:      ${r.rowCount} rows updated`);

    r = await c.query(`UPDATE eci.search s SET categoria = m.to_v
                       FROM _cat_map m
                       WHERE s.pais = m.pais AND s.retail = m.retail AND s.categoria = m.from_v`);
    console.log(`  eci.search.categoria:  ${r.rowCount} rows updated`);

    // ─── fix mojibake retail name SAM'S CLUB MA®XICO -> SAMS CLUB ─
    for (const tbl of ['eci.sos', 'eci.search']) {
      r = await c.query(`UPDATE ${tbl} SET retail = 'SAMS CLUB'
                         WHERE retail LIKE 'SAM%MA%XICO%' OR retail LIKE 'SAM%CLUB%MEX%'`);
      console.log(`  ${tbl}.retail (SAMS CLUB fix): ${r.rowCount} rows updated`);
    }

    // ─── apply to eci.marca_fabricante ────────────────────────────
    // PK is on (marca) alone, so merging two marcas would collide.
    // Strategy: when the canonical 'to' already exists, drop the 'from'
    // row (its fabricante is redundant — the existing canonical wins).
    // Then rename the survivors.
    const mfHas = await c.query(`
      SELECT 1 FROM information_schema.tables
       WHERE table_schema='eci' AND table_name='marca_fabricante' LIMIT 1
    `);
    if (mfHas.rowCount) {
      r = await c.query(`UPDATE eci.marca_fabricante x SET fabricante = m.to_v
                         FROM _fab_map m WHERE x.fabricante = m.from_v`);
      console.log(`  eci.marca_fabricante.fabricante: ${r.rowCount} rows updated`);

      r = await c.query(`
        DELETE FROM eci.marca_fabricante mf
         USING _mar_map m
         WHERE mf.marca = m.from_v
           AND EXISTS (SELECT 1 FROM eci.marca_fabricante x WHERE x.marca = m.to_v)
      `);
      console.log(`  eci.marca_fabricante: ${r.rowCount} colliding rows dropped pre-merge`);

      r = await c.query(`UPDATE eci.marca_fabricante x SET marca = m.to_v
                         FROM _mar_map m WHERE x.marca = m.from_v`);
      console.log(`  eci.marca_fabricante.marca:      ${r.rowCount} rows renamed`);
    }

    await c.query('COMMIT');
    console.log('\nCommit OK.');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('Rolled back:', e.message);
    throw e;
  }

  // ─── refresh MVs (outside the transaction) ──────────────────────
  console.log('\nRefreshing materialized views...');
  const { rows: liveMvs } = await c.query(
    `SELECT schemaname||'.'||matviewname AS mv FROM pg_matviews WHERE schemaname='eci'`,
  );
  const live = new Set(liveMvs.map(r => r.mv));
  const ordered = MV_ORDER.filter(m => live.has(m))
    .concat([...live].filter(m => !MV_ORDER.includes(m)));
  for (const mv of ordered) {
    try {
      const t0 = Date.now();
      await c.query(`REFRESH MATERIALIZED VIEW ${mv}`);
      console.log(`  ${mv}  ok  (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    } catch (e) {
      console.log(`  ${mv}  FAILED (${e.message})`);
    }
  }

  await c.end();
  console.log('\nDone.');
})().catch(e => { console.error(e); process.exit(1); });
