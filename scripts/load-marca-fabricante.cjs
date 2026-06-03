'use strict'
const XLSX   = require('xlsx')
const { Client } = require('pg')
const fs     = require('fs')
const path   = require('path')

// ── env ──────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  // join lines first so quoted values that wrap don't break the regex
  const raw = fs.readFileSync(envPath, 'utf8').replace(/\r\n/g, '\n')
  for (const m of raw.matchAll(/^([A-Z_]+)="([^"]+)"/gm)) {
    process.env[m[1]] = m[2]
  }
}
const DB_URL = process.env.DATABASE_URL
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

// ── normalisation helpers ────────────────────────────────────────────────────
function normalize(s) {
  if (!s || typeof s !== 'string') return ''
  return s.trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Strip common legal-entity suffixes from a fabricante name
function standardizeFab(raw) {
  let f = normalize(raw)
  if (!f) return ''
  f = f
    // S.A.B. de C.V. variants
    .replace(/\bS\.?\s*A\.?\s*B\.?\s*DE\s*C\.?\s*V\.?\b/g, '')
    .replace(/\bS\.?\s*A\.?\s*B\.?\b/g, '')
    // S. de R.L. de C.V. variants
    .replace(/\bS\.?\s*DE\s*R\.?\s*L\.?\s*(DE\s*C\.?\s*V\.?)?\b/g, '')
    // S.A.S.
    .replace(/\bS\.?\s*A\.?\s*S\.?\b/g, '')
    // S.A.
    .replace(/\bS\.?\s*A\.?\b/g, '')
    // other suffixes
    .replace(/\bLTDA\.?\b/g, '')
    .replace(/\bINC\.?\b/g, '')
    .replace(/\bCORP\.?\b/g, '')
    .replace(/\bLLC\.?\b/g, '')
    .replace(/\bN\.?\s*V\.?\b/g, '')
    .replace(/\bSPA\.?\b/g, '')
    .replace(/\bGMBH\.?\b/g, '')
    // tidy up punctuation and whitespace
    .replace(/[,.()\-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return f || normalize(raw) // fallback: basic normalize if stripping emptied the string
}

// ── load xlsx ────────────────────────────────────────────────────────────────
const xlsxPath = path.join(__dirname, '..', 'marca y fabricante.xlsx')
console.log('Reading', xlsxPath)
const wb   = XLSX.readFile(xlsxPath)
const ws   = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(1)
console.log(`Rows in file: ${rows.length}`)

// Build: normalizedMarca → [ { rawFab, stdFab, count } ]
const marcaMap = new Map()  // normalizedMarca → stdFab (single winner)
const conflicts = []

const tempMap = new Map()   // normalizedMarca → Map<stdFab, count>
for (const [marca, fab] of rows) {
  const nm = normalize(marca)
  const sf = standardizeFab(fab)
  if (!nm || !sf) continue
  if (!tempMap.has(nm)) tempMap.set(nm, new Map())
  const inner = tempMap.get(nm)
  inner.set(sf, (inner.get(sf) || 0) + 1)
}

for (const [nm, fabCounts] of tempMap) {
  const sorted = [...fabCounts.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 1) {
    marcaMap.set(nm, sorted[0][0])
  } else {
    // multiple fabricantes — keep the most frequent one, log conflict
    marcaMap.set(nm, sorted[0][0])
    conflicts.push({ marca: nm, options: sorted.map(([f, c]) => `${f}(${c})`).join(' | ') })
  }
}

console.log(`Unique brands mapped: ${marcaMap.size}`)
if (conflicts.length) {
  console.log(`\n⚠  ${conflicts.length} brands with multiple fabricantes (keeping most frequent):`)
  conflicts.slice(0, 40).forEach(c => console.log(`   ${c.marca}: ${c.options}`))
  if (conflicts.length > 40) console.log(`   ... and ${conflicts.length - 40} more`)
}

// ── connect to DB ────────────────────────────────────────────────────────────
async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log('\nConnected to DB')

  // ── 1. Rebuild table schema: drop pais + n_apariciones, new PK on marca ──
  console.log('\nRebuilding eci.marca_fabricante schema...')
  await client.query(`
    DO $$
    BEGIN
      -- drop dependent MVs first (they join on pais)
      DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_daily_titulo    CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_daily_marca     CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_daily_fab       CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS eci.mv_search_daily_marca  CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS eci.mv_search_daily_fab    CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_dimensions      CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS eci.mv_sos_product_latest  CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS eci.mv_ranking_daily_titulo CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS eci.mv_ranking_daily_marca  CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS eci.mv_ranking_daily_fab    CASCADE;
      -- only do schema migration if pais still exists
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='eci' AND table_name='marca_fabricante' AND column_name='pais'
      ) THEN
        -- deduplicate: keep one fabricante per marca (most common non-null one)
        DELETE FROM eci.marca_fabricante mf1
        USING eci.marca_fabricante mf2
        WHERE mf1.marca = mf2.marca
          AND mf1.ctid > mf2.ctid;
        -- drop old PK and columns
        ALTER TABLE eci.marca_fabricante DROP CONSTRAINT IF EXISTS marca_fabricante_pkey CASCADE;
        ALTER TABLE eci.marca_fabricante DROP COLUMN IF EXISTS pais;
        ALTER TABLE eci.marca_fabricante DROP COLUMN IF EXISTS n_apariciones;
        -- add new PK
        ALTER TABLE eci.marca_fabricante ADD PRIMARY KEY (marca);
      END IF;
    END$$;
  `)
  console.log('  Schema updated.')

  // ── 2. Get all distinct marcas from eci.sos ───────────────────────────────
  console.log('\nFetching distinct marcas from eci.sos...')
  const { rows: sosMarcas } = await client.query(`
    SELECT DISTINCT marca FROM eci.sos WHERE marca IS NOT NULL ORDER BY marca
  `)
  console.log(`  ${sosMarcas.length} distinct marcas`)

  // ── 3. Match and collect upserts ─────────────────────────────────────────
  let matched = 0, unmatched = 0
  const upserts = []
  for (const { marca } of sosMarcas) {
    const nm  = normalize(marca)
    const fab = marcaMap.get(nm)
    if (fab) {
      upserts.push([marca, fab])
      matched++
    } else {
      unmatched++
    }
  }
  console.log(`  Matched: ${matched}  |  Unmatched (no fabricante in file): ${unmatched}`)

  // ── 4. Batch upsert in chunks of 200 ─────────────────────────────────────
  console.log('\nUpserting into eci.marca_fabricante...')
  const CHUNK = 200
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const chunk = upserts.slice(i, i + CHUNK)
    const values = chunk.map((_, j) => `($${j*2+1}, $${j*2+2})`).join(', ')
    const flat   = chunk.flat()
    await client.query(`
      INSERT INTO eci.marca_fabricante (marca, fabricante)
      VALUES ${values}
      ON CONFLICT (marca) DO UPDATE SET fabricante = EXCLUDED.fabricante
    `, flat)
    if ((i + CHUNK) % 2000 < CHUNK) console.log(`  ${Math.min(i + CHUNK, upserts.length)} / ${upserts.length}`)
  }
  console.log(`  Upserted ${upserts.length} rows`)

  // ── 5. Recreate ALL MVs (SOS + search + ranking) without pais join ─────────
  const FAB_UNIFIED = `CASE WHEN UPPER(COALESCE(s.fabricante, mf.fabricante, '')) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(s.fabricante, mf.fabricante, 'MARCA LOCAL') END`
  const mfJoin = `LEFT JOIN eci.marca_fabricante mf ON UPPER(s.marca) = UPPER(mf.marca)`
  // ranking MVs already dropped in step 1, guard just in case
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_ranking_daily_titulo CASCADE`)
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_ranking_daily_marca  CASCADE`)
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_ranking_daily_fab    CASCADE`)

  // ── SOS MVs ────────────────────────────────────────────────────────────────
  console.log('\nCreating mv_sos_daily_fab...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_sos_daily_fab AS
    SELECT DATE(s.fecha) AS fecha, s.retail, s.pais, s.categoria,
      ${FAB_UNIFIED} AS fabricante,
      COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.sos s ${mfJoin}
    GROUP BY DATE(s.fecha), s.retail, s.pais, s.categoria, ${FAB_UNIFIED}
  `)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_fab (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_fab (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_fab (retail)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_fab (fecha, retail, pais, categoria)`)
  console.log('  OK')

  console.log('Creating mv_sos_daily_marca...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_sos_daily_marca AS
    SELECT DATE(s.fecha) AS fecha, s.retail, s.pais, s.categoria, s.marca,
      ${FAB_UNIFIED} AS fabricante,
      COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.sos s ${mfJoin}
    GROUP BY DATE(s.fecha), s.retail, s.pais, s.categoria, s.marca, ${FAB_UNIFIED}
  `)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_marca (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_marca (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_marca (marca)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_marca (fecha, retail, pais, categoria)`)
  console.log('  OK')

  console.log('Creating mv_sos_daily_titulo...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_sos_daily_titulo AS
    SELECT DATE(s.fecha) AS fecha, s.retail, s.pais, s.categoria,
      s.skuid AS producto_id,
      MAX(s.titulo) AS titulo,
      ${FAB_UNIFIED} AS fabricante,
      COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
      COUNT(*) AS count_total,
      MIN(s.orden) AS best_ranking
    FROM eci.sos s ${mfJoin}
    GROUP BY DATE(s.fecha), s.retail, s.pais, s.categoria, s.skuid, ${FAB_UNIFIED}
  `)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_titulo (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_titulo (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_daily_titulo (fecha, retail, pais, categoria)`)
  console.log('  OK')

  console.log('Creating mv_sos_dimensions...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_sos_dimensions AS
    SELECT retail, pais, categoria,
      MIN(fecha) AS min_fecha,
      MAX(fecha) AS max_fecha
    FROM eci.sos
    GROUP BY retail, pais, categoria
  `)
  await client.query(`CREATE INDEX ON eci.mv_sos_dimensions (retail)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_dimensions (pais)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_dimensions (categoria)`)
  console.log('  OK')

  console.log('Creating mv_sos_product_latest...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_sos_product_latest AS
    SELECT DISTINCT ON (s.skuid, s.retail, s.pais)
      s.skuid AS producto_id,
      s.titulo,
      s.marca,
      ${FAB_UNIFIED} AS fabricante,
      s.retail,
      s.pais,
      s.categoria,
      s.precio_neto,
      s.imagen,
      s.url_producto,
      s.fecha
    FROM eci.sos s ${mfJoin}
    ORDER BY s.skuid, s.retail, s.pais, s.fecha DESC
  `)
  await client.query(`CREATE INDEX ON eci.mv_sos_product_latest (producto_id)`)
  await client.query(`CREATE INDEX ON eci.mv_sos_product_latest (fabricante)`)
  console.log('  OK')

  // ── Search MVs ─────────────────────────────────────────────────────────────
  const mfJoinSearch = `LEFT JOIN eci.marca_fabricante mf ON UPPER(s.marca) = UPPER(mf.marca)`
  const FAB_UNIFIED_S = `CASE WHEN UPPER(COALESCE(s.fabricante, mf.fabricante, '')) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(s.fabricante, mf.fabricante, 'MARCA LOCAL') END`

  console.log('Creating mv_search_daily_fab...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_search_daily_fab AS
    SELECT DATE(s.fecha) AS fecha, s.pais, s.retail, s.search,
      ${FAB_UNIFIED_S} AS fabricante,
      COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.search s ${mfJoinSearch}
    GROUP BY DATE(s.fecha), s.pais, s.retail, s.search, ${FAB_UNIFIED_S}
  `)
  await client.query(`CREATE INDEX ON eci.mv_search_daily_fab (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_search_daily_fab (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_search_daily_fab (retail)`)
  await client.query(`CREATE INDEX ON eci.mv_search_daily_fab (fecha, retail, pais)`)
  console.log('  OK')

  console.log('Creating mv_search_daily_marca...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_search_daily_marca AS
    SELECT DATE(s.fecha) AS fecha, s.pais, s.retail, s.search, s.marca,
      ${FAB_UNIFIED_S} AS fabricante,
      COUNT(*) FILTER (WHERE s.pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.search s ${mfJoinSearch}
    GROUP BY DATE(s.fecha), s.pais, s.retail, s.search, s.marca, ${FAB_UNIFIED_S}
  `)
  await client.query(`CREATE INDEX ON eci.mv_search_daily_marca (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_search_daily_marca (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_search_daily_marca (marca)`)
  await client.query(`CREATE INDEX ON eci.mv_search_daily_marca (fecha, retail, pais)`)
  console.log('  OK')

  // ── Ranking MVs ────────────────────────────────────────────────────────────
  console.log('Creating mv_ranking_daily_fab...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_ranking_daily_fab AS
    SELECT DATE(s.fecha) AS fecha, s.retail, s.pais, s.categoria,
      ${FAB_UNIFIED} AS fabricante,
      SUM(CASE WHEN s.pagina = 1 THEN s.ranking::numeric ELSE 0 END) AS sum_ranking_p1,
      SUM(s.ranking::numeric) AS sum_ranking_total
    FROM eci.sos s ${mfJoin}
    WHERE s.ranking IS NOT NULL
    GROUP BY DATE(s.fecha), s.retail, s.pais, s.categoria, ${FAB_UNIFIED}
  `)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_fab (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_fab (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_fab (retail)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_fab (fecha, retail, pais, categoria)`)
  console.log('  OK')

  console.log('Creating mv_ranking_daily_marca...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_ranking_daily_marca AS
    SELECT DATE(s.fecha) AS fecha, s.retail, s.pais, s.categoria, s.marca,
      ${FAB_UNIFIED} AS fabricante,
      SUM(CASE WHEN s.pagina = 1 THEN s.ranking::numeric ELSE 0 END) AS sum_ranking_p1,
      SUM(s.ranking::numeric) AS sum_ranking_total
    FROM eci.sos s ${mfJoin}
    WHERE s.ranking IS NOT NULL
    GROUP BY DATE(s.fecha), s.retail, s.pais, s.categoria, s.marca, ${FAB_UNIFIED}
  `)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_marca (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_marca (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_marca (marca)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_marca (fecha, retail, pais, categoria)`)
  console.log('  OK')

  console.log('Creating mv_ranking_daily_titulo...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_ranking_daily_titulo AS
    SELECT DATE(s.fecha) AS fecha, s.retail, s.pais, s.categoria,
      s.titulo AS titulo_id,
      MAX(s.titulo) AS titulo,
      ${FAB_UNIFIED} AS fabricante,
      SUM(CASE WHEN s.pagina = 1 THEN s.ranking::numeric ELSE 0 END) AS sum_ranking_p1,
      SUM(s.ranking::numeric) AS sum_ranking_total
    FROM eci.sos s ${mfJoin}
    WHERE s.ranking IS NOT NULL
    GROUP BY DATE(s.fecha), s.retail, s.pais, s.categoria, s.titulo, ${FAB_UNIFIED}
  `)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_titulo (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_titulo (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_titulo (fecha, retail, pais, categoria)`)
  console.log('  OK')

  // ── 6. Verify ────────────────────────────────────────────────────────────
  console.log('\nVerification:')
  const { rows: r1 } = await client.query(`SELECT pais, COUNT(DISTINCT fabricante) AS fabs FROM eci.mv_sos_daily_fab GROUP BY pais ORDER BY pais`)
  r1.forEach(r => console.log(`  SOS ${r.pais}: ${r.fabs} fabricantes`))

  const { rows: r2 } = await client.query(`SELECT matviewname FROM pg_matviews WHERE schemaname='eci' ORDER BY 1`)
  console.log('\nAll MVs:', r2.map(r => r.matviewname).join(', '))

  await client.end()
  console.log('\nDone!')
}

main().catch(e => { console.error(e); process.exit(1) })

