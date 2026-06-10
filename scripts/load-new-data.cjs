/**
 * load-new-data.cjs
 * Incremental ETL: reads ConsolidadoSOS / ConsolidadoSearch xlsx files,
 * applies all normalizations from fix_and_load.py, and upserts only dates
 * not yet present in the DB.
 *
 * Usage:
 *   node scripts/load-new-data.cjs          # both SOS + Search, all countries
 *   node scripts/load-new-data.cjs sos       # SOS only
 *   node scripts/load-new-data.cjs search    # Search only
 */

const XLSX = require('xlsx');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── Config ────────────────────────────────────────────────────────────────
const DB = fs.readFileSync(
  path.join(__dirname, '..', '.env.local'), 'utf8'
).match(/DATABASE_URL="([^"]+)"/)?.[1];

const DRIVE_BASE = "G:\\.shortcut-targets-by-id\\1-L071oTvKPJY-lVRZOyAYxUiplTpPE7v\\HCSMKT\\Abbot";
const SOS_BASE    = path.join(DRIVE_BASE, 'SOS',    'basesFinales');
const SEARCH_BASE = path.join(DRIVE_BASE, 'Search', 'basesFinales');
const COUNTRIES   = { 'Mexico': 'MX', 'Colombia': 'CO', 'Per\u00FA': 'PE' };
const BATCH_SIZE  = 500;

// ── Retail canonical mapping (mirrors fix_and_load.py) ────────────────────
const RETAIL_RAW = {
  'rappi': 'RAPPI', 'rappi search': 'RAPPI', 'rappis_search': 'RAPPI',
  'cruzverde': 'CRUZ VERDE', 'cruzverde search': 'CRUZ VERDE', 'cruzverde_search': 'CRUZ VERDE',
  'cruz verde': 'CRUZ VERDE', 'cruz verde search': 'CRUZ VERDE',
  'farmatodo': 'FARMATODO', 'farmatodo search': 'FARMATODO', 'farmatodo_search': 'FARMATODO',
  'rebajavirtual': 'REBAJA VIRTUAL', 'rebaja virtual': 'REBAJA VIRTUAL',
  'rebaja virtual search': 'REBAJA VIRTUAL', 'rebaja_virtual_search': 'REBAJA VIRTUAL',
  'tu drogueria virtual': 'TU DROGUERIA VIRTUAL',
  'tu drogueria virtual search': 'TU DROGUERIA VIRTUAL',
  'tu drogueria virtual_search': 'TU DROGUERIA VIRTUAL',
  'drogueriavirtual': 'DROGUERIA VIRTUAL', 'drogueria virtual': 'DROGUERIA VIRTUAL',
  'farmacia ahorro mx': 'FARMACIA DEL AHORRO', 'ahorro': 'FARMACIA DEL AHORRO',
  'farmacias del ahorro': 'FARMACIA DEL AHORRO', 'farmacia del ahorro': 'FARMACIA DEL AHORRO',
  'san pablo': 'FARMACIA SAN PABLO', 'san_pablo': 'FARMACIA SAN PABLO',
  'farmacia san pablo mx': 'FARMACIA SAN PABLO', 'farmacia san pablo': 'FARMACIA SAN PABLO',
  'mercado libre mx': 'MERCADO LIBRE', 'mercado libre': 'MERCADO LIBRE', 'meli': 'MERCADO LIBRE',
  'walmart mx': 'WALMART', 'walmart': 'WALMART',
  'walmart mexico': 'WALMART', 'walmart m\u00e9xico': 'WALMART',
  'sams': 'SAMS CLUB', 'sams mx': 'SAMS CLUB',
  "sam's club m\u00e9xico": 'SAMS CLUB', "sam's club mexico": 'SAMS CLUB',
  'sams club mexico': 'SAMS CLUB', 'sams club': 'SAMS CLUB',
  'inkafarma': 'INKAFARMA', 'inca search': 'INKAFARMA', 'inca_search': 'INKAFARMA',
  'mifarma': 'MIFARMA', 'tottus': 'TOTTUS',
  'amazon': 'AMAZON', 'heb': 'HEB', 'benavides': 'BENAVIDES',
  'farmacias benavides': 'FARMACIAS BENAVIDES',
};

function stripAccents(s) {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizeRetailKey(s) {
  return stripAccents(String(s)).toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function canonRetail(v) {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  const key = normalizeRetailKey(s);
  if (RETAIL_RAW[key]) return RETAIL_RAW[key];
  // Try stripping trailing suffixes
  for (const sfx of [' search', ' mx', ' m\u00e9xico', ' mexico', ' ar']) {
    if (key.endsWith(sfx)) {
      const k2 = key.slice(0, -sfx.length).trim();
      if (RETAIL_RAW[k2]) return RETAIL_RAW[k2];
    }
  }
  return stripAccents(s).toUpperCase();
}

// ── Text normalization ────────────────────────────────────────────────────
const SPANISH_LOWER = new Set(['de','del','y','la','el','los','las','en','con','por','para','a','al','un','una']);

function fixMojibake(s) {
  if (typeof s !== 'string') return s;
  // Try latin-1 → utf-8 decode heuristic
  if (/[\xC3\xC2][\x80-\xBF]/.test(s)) {
    try {
      return Buffer.from(s, 'latin1').toString('utf8');
    } catch {}
  }
  return s;
}

function normText(v) {
  if (v == null) return null;
  let s = String(v);
  s = fixMojibake(s);
  s = s.replace(/\u00b4/g, "'").replace(/\s+/g, ' ').trim();
  return s || null;
}

function titleCase(v) {
  const s = normText(v);
  if (!s) return null;
  return s.split(' ').map((w, i) => {
    if (i > 0 && SPANISH_LOWER.has(w.toLowerCase())) return w.toLowerCase();
    if (w.length <= 4 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

function upperNorm(v) {
  const s = normText(v);
  if (!s) return null;
  return stripAccents(s).toUpperCase();
}

function toNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const s = String(v).replace(/%/g, '').replace(/,/g, '').trim();
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function toInt(v) {
  const n = toNum(v);
  return n == null ? null : Math.round(n);
}

function toBool(v) {
  if (v == null) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true','1','yes','sí','si','t'].includes(s)) return true;
  if (['false','0','no','n','f'].includes(s)) return false;
  return null;
}

// ── Column name map (from xlsx → DB) ─────────────────────────────────────
const COL_MAP = {
  'fecha':'fecha','titulo':'titulo','ean':'ean','marca':'marca',
  'precio venta':'precio_venta','precio neto':'precio_neto',
  'promocion':'promocion','descuento':'descuento',
  'categoria':'categoria','subcategoria':'subcategoria','subcategoria_1':'subcategoria_1',
  'retail':'retail','skuid':'skuid',
  'Orden':'orden','orden':'orden',
  'Ranking':'ranking','ranking':'ranking',
  'P\u00e1gina':'pagina','Pagina':'pagina','pagina':'pagina',
  'p\u00e1gina':'pagina',
  'en_stock':'en_stock','url_producto':'url_producto',
  'fabricante':'fabricante','presentacion':'presentacion',
  'fidelizacion':'fidelizacion','imagen':'imagen',
};

const SOS_COLS    = ['id','pais','fecha','titulo','ean','marca','precio_venta','precio_neto','promocion','descuento','categoria','subcategoria','retail','skuid','orden','ranking','pagina','en_stock','url_producto','fabricante','presentacion','fidelizacion','imagen'];
const SEARCH_COLS = ['id','pais','fecha','titulo','ean','marca','precio_venta','precio_neto','promocion','descuento','categoria','search','retail','skuid','orden','ranking','pagina','en_stock','url_producto','fabricante','presentacion','fidelizacion','imagen'];

function computeId(row) {
  const ean = row.ean;
  if (ean != null && String(ean).trim()) return String(ean).trim();
  const skuid = row.skuid;
  if (skuid != null && String(skuid).trim()) return String(skuid).trim();
  const key = [row.titulo||'', row.marca||'', row.retail||''].join('|');
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function normalizeRows(rawRows, pais, fileDate, kind) {
  const targetCols = kind === 'Search' ? SEARCH_COLS : SOS_COLS;
  const rows = [];

  for (const raw of rawRows) {
    // Map columns
    const r = {};
    for (const [k, v] of Object.entries(raw)) {
      const mapped = COL_MAP[k];
      if (mapped && r[mapped] == null) r[mapped] = v; // first non-null wins for dupes
    }

    // Handle duplicate / encoded column names (e.g. both "PÃ¡gina" and "Página")
    // Find pagina from any column matching
    if (r.pagina == null) {
      for (const k of Object.keys(raw)) {
        if (k.toLowerCase().includes('gina') || k.toLowerCase() === 'pagina') {
          const v = raw[k];
          if (v != null) { r.pagina = v; break; }
        }
      }
    }

    // Search term extraction
    if (kind === 'Search') {
      if (pais === 'MX') {
        r.search = r.categoria || null;
        r.categoria = null;
      } else {
        r.search = r.subcategoria || null;
      }
      delete r.subcategoria;
      delete r.subcategoria_1;
    }

    // Text columns
    for (const c of ['titulo','categoria','subcategoria','subcategoria_1','presentacion','promocion','search']) {
      if (c in r) r[c] = titleCase(r[c]);
    }
    for (const c of ['marca','fabricante']) {
      if (c in r) r[c] = upperNorm(r[c]);
    }
    r.retail = canonRetail(r.retail);
    r.ean = normText(r.ean);
    r.skuid = normText(r.skuid);
    r.url_producto = normText(r.url_producto);
    r.fidelizacion = normText(r.fidelizacion);
    r.imagen = normText(r.imagen);

    // Numerics
    r.precio_venta = toNum(r.precio_venta);
    r.precio_neto  = toNum(r.precio_neto);
    r.ranking      = toNum(r.ranking);
    r.orden        = toInt(r.orden);
    r.pagina       = toInt(r.pagina);
    r.en_stock     = toBool(r.en_stock);

    // Fix inverted prices (precio_venta > precio_neto → swap)
    if (r.precio_venta != null && r.precio_neto != null && r.precio_neto > 0 && r.precio_venta > r.precio_neto * 1.01) {
      [r.precio_venta, r.precio_neto] = [r.precio_neto, r.precio_venta];
    }
    // Recompute descuento as fraction [0,1]
    if (r.precio_venta != null && r.precio_neto != null && r.precio_neto > 0) {
      const d = 1 - r.precio_venta / r.precio_neto;
      r.descuento = (d >= 0 && d <= 1) ? Math.round(d * 10000) / 10000 : null;
    } else {
      r.descuento = null;
    }

    // fecha override from filename
    r.fecha = fileDate;

    // Drop rows missing critical fields
    if (!r.titulo || !r.retail) continue;

    // Compute id
    r.id = computeId(r);

    // Null PK parts
    if (kind === 'Search') r.search = r.search || '';
    else r.subcategoria = r.subcategoria || '';

    // Add pais
    r.pais = pais;

    // Build row in target col order
    const out = {};
    for (const c of targetCols) out[c] = r[c] ?? null;
    rows.push(out);
  }

  // Dedup within the file
  const seen = new Set();
  return rows.filter(row => {
    const key = kind === 'Search'
      ? `${row.fecha}|${row.id}|${row.search}|${row.retail}`
      : `${row.fecha}|${row.id}|${row.retail}|${row.subcategoria}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── DB batch insert ───────────────────────────────────────────────────────
async function insertBatch(client, table, cols, rows) {
  if (!rows.length) return;
  const placeholders = rows.map((_, ri) =>
    `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(',')})`
  ).join(',');
  const values = rows.flatMap(r => cols.map(c => r[c] ?? null));
  await client.query(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    values
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const mode = process.argv[2]?.toLowerCase() || 'both';
  const doSOS    = mode === 'both' || mode === 'sos';
  const doSearch = mode === 'both' || mode === 'search';

  const client = new Client({ connectionString: DB });
  await client.connect();
  console.log('Connected to DB\n');

  // Get max dates already in DB
  const sosMaxRes = await client.query(
    `SELECT pais, MAX(fecha::date)::text AS max_d FROM eci.sos GROUP BY pais`
  );
  const searchMaxRes = await client.query(
    `SELECT pais, MAX(fecha::date)::text AS max_d FROM eci.search GROUP BY pais`
  );
  const sosMax    = Object.fromEntries(sosMaxRes.rows.map(r => [r.pais, r.max_d]));
  const searchMax = Object.fromEntries(searchMaxRes.rows.map(r => [r.pais, r.max_d]));

  console.log('Current DB max dates (SOS):', JSON.stringify(sosMax));
  console.log('Current DB max dates (Search):', JSON.stringify(searchMax));
  console.log('');

  for (const [country, pais] of Object.entries(COUNTRIES)) {
    for (const [kindLabel, doIt, base, maxDates, table, cols] of [
      ['SOS',    doSOS,    SOS_BASE,    sosMax,    'eci.sos',    SOS_COLS],
      ['Search', doSearch, SEARCH_BASE, searchMax, 'eci.search', SEARCH_COLS],
    ]) {
      if (!doIt) continue;
      const dir = path.join(base, country);
      if (!fs.existsSync(dir)) { console.log(`Skipping ${kindLabel}/${country} — folder not found`); continue; }

      const maxDate = maxDates[pais] || '2000-01-01';
      const xlsxFiles = fs.readdirSync(dir)
        .filter(f => f.endsWith('.xlsx') && !f.startsWith('~') && !f.startsWith('.'))
        .map(f => {
          const m = f.match(/(\d{4}-\d{2}-\d{2})/);
          return m ? { name: f, date: m[1] } : null;
        })
        .filter(f => f && f.date > maxDate)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (!xlsxFiles.length) {
        console.log(`${kindLabel}/${country} (${pais}): already up to date (max=${maxDate})`);
        continue;
      }

      console.log(`${kindLabel}/${country} (${pais}): ${xlsxFiles.length} new files (newest in DB: ${maxDate})`);

      let totalInserted = 0;
      for (const { name, date } of xlsxFiles) {
        const filePath = path.join(dir, name);
        try {
          const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null });
          if (!rawRows.length) { process.stdout.write(`  [${date}] empty\n`); continue; }

          const rows = normalizeRows(rawRows, pais, date, kindLabel);
          if (!rows.length) { process.stdout.write(`  [${date}] 0 rows after normalization\n`); continue; }

          // Delete existing rows for this date+pais (safety)
          const colName = kindLabel === 'Search' ? 'search' : 'sos';
          await client.query(
            `DELETE FROM ${table} WHERE fecha::date = $1 AND pais = $2`,
            [date, pais]
          );

          // Insert in batches
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            await insertBatch(client, table, cols, rows.slice(i, i + BATCH_SIZE));
          }

          totalInserted += rows.length;
          process.stdout.write(`  [${date}] ${rows.length} rows inserted\n`);
        } catch (err) {
          console.error(`  [${date}] ERROR: ${err.message}`);
        }
      }
      console.log(`  → Total inserted for ${kindLabel}/${country}: ${totalInserted}\n`);
    }
  }

  // Update fabricante from marca_fabricante where null
  console.log('Updating NULL fabricante from marca_fabricante...');
  const sosUpd = await client.query(`
    UPDATE eci.sos s
    SET fabricante = mf.fabricante
    FROM eci.marca_fabricante mf
    WHERE s.marca = mf.marca
      AND (s.fabricante IS NULL OR s.fabricante = '')
  `);
  console.log(`  SOS: ${sosUpd.rowCount} rows updated`);

  const searchUpd = await client.query(`
    UPDATE eci.search s
    SET fabricante = mf.fabricante
    FROM eci.marca_fabricante mf
    WHERE s.marca = mf.marca
      AND (s.fabricante IS NULL OR s.fabricante = '')
  `);
  console.log(`  Search: ${searchUpd.rowCount} rows updated`);

  // Rows still null → MARCA LOCAL
  await client.query(`UPDATE eci.sos    SET fabricante = 'MARCA LOCAL' WHERE fabricante IS NULL OR fabricante = ''`);
  await client.query(`UPDATE eci.search SET fabricante = 'MARCA LOCAL' WHERE fabricante IS NULL OR fabricante = ''`);

  // Normalize ABBOTT variants
  await client.query(`UPDATE eci.sos    SET fabricante = 'ABBOTT' WHERE UPPER(fabricante) LIKE '%ABBOT%' AND fabricante != 'ABBOTT'`);
  await client.query(`UPDATE eci.search SET fabricante = 'ABBOTT' WHERE UPPER(fabricante) LIKE '%ABBOT%' AND fabricante != 'ABBOTT'`);

  console.log('\nRefreshing materialized views...');
  for (const mv of ['eci.mv_sos_daily_fab','eci.mv_sos_daily_marca','eci.mv_search_daily_fab','eci.mv_search_daily_marca','eci.mv_sos_dimensions']) {
    try {
      await client.query(`REFRESH MATERIALIZED VIEW ${mv}`);
      console.log(`  Refreshed ${mv}`);
    } catch (e) {
      console.error(`  Failed to refresh ${mv}: ${e.message}`);
    }
  }

  // Final summary
  const summary = await client.query(`
    SELECT 'sos' AS tbl, pais, MIN(fecha::date)::text AS min_d, MAX(fecha::date)::text AS max_d, COUNT(*)::int AS total
    FROM eci.sos GROUP BY pais
    UNION ALL
    SELECT 'search', pais, MIN(fecha::date)::text, MAX(fecha::date)::text, COUNT(*)::int
    FROM eci.search GROUP BY pais
    ORDER BY 1, 2
  `);
  console.log('\n=== Final DB state ===');
  console.table(summary.rows);

  await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
