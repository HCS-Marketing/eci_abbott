/**
 * cleanup-plan.cjs
 *
 * Builds a unified standardization plan for fabricantes, marcas and categories.
 *
 * Steps:
 *   1. Pulls every distinct fabricante / marca / (pais,retail,categoria) with row counts.
 *   2. Groups them by a normalized key (case + accents + punctuation stripped).
 *   3. For each cluster picks a canonical form:
 *        - Prefers the variant with no mojibake (e.g. 'ÔÇÖ', 'Ã©').
 *        - Among the rest picks the one with the highest row count.
 *        - Applies a small list of hard overrides for cases we agreed on.
 *   4. For fabricantes with a country/region suffix (NESTLE vs NESTLE COLOMBIA, ...)
 *      it checks whether both forms appear in the same pais; if yes -> merge.
 *
 * Writes:
 *   scripts/_cleanup-plan.json  (machine-readable mappings)
 *   scripts/_cleanup-plan.txt   (human-readable summary)
 *
 * Does NOT touch the database.
 */
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

const DB = fs.readFileSync(
  path.join(__dirname, '..', '.env.local'), 'utf8'
).match(/DATABASE_URL="([^"]+)"/)?.[1];

const OUT_JSON = path.join(__dirname, '_cleanup-plan.json');
const OUT_TXT  = path.join(__dirname, '_cleanup-plan.txt');

// ─── helpers ────────────────────────────────────────────────────

// Common Windows-1252 / UTF-8 double-encoding artifacts.
const MOJIBAKE_PATTERNS = /(ÔÇÖ|ÔÇ£|ÔÇ¥|Ã©|Ã³|Ã¡|Ã­|Ãº|Ã±|Ã¼|Â®|â€™|â€œ|â€\u009d|MA®|Ô\u0080|ï¿½)/;

const MOJIBAKE_FIXES = [
  [/ÔÇÖ/g, "'"],
  [/ÔÇ£/g, '"'],
  [/ÔÇ¥/g, '"'],
  [/â€™/g, "'"],
  [/â€œ/g, '"'],
  [/â€\u009d/g, '"'],
  [/Ã©/g, 'é'],
  [/Ã³/g, 'ó'],
  [/Ã¡/g, 'á'],
  [/Ã­/g, 'í'],
  [/Ãº/g, 'ú'],
  [/Ã±/g, 'ñ'],
  [/Ã¼/g, 'ü'],
  [/MA®/g, ''],          // SAM'S CLUB MA®XICO  ->  SAM'S CLUB MEXICO  (we want SAMS CLUB anyway)
];

function cleanMojibake(s) {
  if (!s) return s;
  let out = s;
  for (const [re, rep] of MOJIBAKE_FIXES) out = out.replace(re, rep);
  return out;
}

function hasMojibake(s) {
  return s && MOJIBAKE_PATTERNS.test(s);
}

// Normalized key: strip accents, lower, keep only [a-z0-9]
function normKey(s) {
  if (!s) return '';
  const fixed = cleanMojibake(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return fixed.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Hard overrides for fabricante canonicals (key -> preferred variant).
// Built from the table we agreed on.
const FAB_CANON_OVERRIDE = {
  LOREAL:           "L'OREAL",
  LOREALPARIS:      "L'OREAL PARIS",
  KIMBERLYCLARK:    'KIMBERLY-CLARK',
  HEB:              'HEB',
  SCJOHNSON:        'SC JOHNSON',
  MEGALABS:         'MEGALABS',
  KEZERLAB:         'KEZER-LAB',
  DRBROWNS:         "DR. BROWN'S",
  ABBVIE:           'ABBVIE',
  NATURESBOUNTY:    "NATURE'S BOUNTY",
  KELLOGGS:         "KELLOGG'S",
  MEADJOHNSON:      'MEAD JOHNSON',
  PROCTERGAMBLE:    'PROCTER & GAMBLE',
  MARCALOCAL:       'MARCA LOCAL',
  JOHNSONS:         "JOHNSON'S",
  BOTANICALS:       "BOTANICAL'S",
  MERCKSHARPDOHME:  'MERCK SHARP & DOHME',
  GLAXOSMITHKLINE:  'GLAXOSMITHKLINE',
  BSNMEDICAL:       'BSN MEDICAL',
  MYPROTEIN:        'MY PROTEIN',
  NATURASTRUTH:     "NATURE'S TRUTH",
  NATURESTRUTH:     "NATURE'S TRUTH",
  PURITANSPRIDE:    "PURITAN'S PRIDE",
  ADNWOMENS:        "ADN WOMEN'S",
  BAUSCHLOMB:       'BAUSCH & LOMB',
  BRISTOLMYERSSQUIBB: 'BRISTOL-MYERS SQUIBB',
  ENFAGROWMEADJOHNSONNUTRITION: 'ENFAGROW (MEAD JOHNSON NUTRITION)',
  SUNDESABLENDERBOTTLE: 'SUNDESA (BLENDERBOTTLE)',
  LIFESCANJOHNSONJOHNSONPLATINUMEQUITY: 'LIFESCAN (JOHNSON & JOHNSON / PLATINUM EQUITY)',
  TECNOQUIMICASMK: 'TECNOQUIMICAS (MK)',
  OMEGAMARCALOCAL: 'OMEGA (MARCA LOCAL)',
  NESTLETERRAFERTIL: 'NESTLE (TERRAFERTIL)',
  PHARMAMEDICOMARINOMEDPHARMAMEDICOGROUP: 'PHARMA MEDICO (MARINOMED / PHARMA MEDICO GROUP)',
  COSECHADELPARAISO: 'COSECHA DEL PARAISO',
};

// Hard merges that are NOT typographic but the user explicitly approved.
// fabricante (verbatim) -> target fabricante (verbatim).
// Per user instruction: TECNOQUIMICA + letters (MK, OTC, etc.) are real product
// lines and must be kept distinct from generic 'TECNOQUIMICAS'.
const FAB_HARD_MERGE = {
  'SOTTCOR':              'SOTTCOR LABS',
  'TRIFARMA OTC':         'TRIFARMA',
  // only normalize the paren typo within the TECNOQUIMICAS (MK) cluster
  'TECNOQUIMICAS (MK':    'TECNOQUIMICAS (MK)',
};

// Country/region suffixes we should evaluate for fabricantes.
const COUNTRY_TOKENS = [
  'COLOMBIA', 'MEXICO', 'PERU', 'CHILE', 'ARGENTINA', 'BRASIL', 'BRAZIL',
  'ECUADOR', 'BOLIVIA', 'VENEZUELA', 'URUGUAY', 'PARAGUAY',
  'ANDINA', 'LATAM', 'LATINOAMERICA', 'COL', 'MX', 'PE',
];

// ─── main ───────────────────────────────────────────────────────
(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();

  // Pull distinct fabricantes per (pais, table)
  const { rows: fabRowsRaw } = await c.query(`
    SELECT fabricante, pais, SUM(n)::bigint AS n FROM (
      SELECT fabricante, pais, COUNT(*)::int AS n FROM eci.sos    GROUP BY fabricante, pais
      UNION ALL
      SELECT fabricante, pais, COUNT(*)::int AS n FROM eci.search GROUP BY fabricante, pais
    ) z
    GROUP BY fabricante, pais
  `);

  // ─── FABRICANTE PLAN ──────────────────────────────────────────
  // total counts per fabricante (across pais), and per-pais counts.
  const fabTotal = new Map();      // fabricante -> total rows
  const fabByPais = new Map();     // fabricante -> Map(pais -> rows)
  for (const r of fabRowsRaw) {
    if (!r.fabricante) continue;
    fabTotal.set(r.fabricante, (fabTotal.get(r.fabricante) || 0) + Number(r.n));
    if (!fabByPais.has(r.fabricante)) fabByPais.set(r.fabricante, new Map());
    fabByPais.get(r.fabricante).set(r.pais, Number(r.n));
  }

  // Group by normalized key (typographic clusters)
  const fabClusters = new Map();   // key -> [{name, count}]
  for (const [name, count] of fabTotal.entries()) {
    const k = normKey(name);
    if (!k) continue;
    if (!fabClusters.has(k)) fabClusters.set(k, []);
    fabClusters.get(k).push({ name, count });
  }

  // Build fab -> canonical map from typographic clusters
  const fabMap = {};
  const fabTypoClusters = [];   // for human report
  for (const [key, variants] of fabClusters.entries()) {
    if (variants.length < 2) continue;
    // pick canonical
    let canonical;
    if (FAB_CANON_OVERRIDE[key]) {
      canonical = FAB_CANON_OVERRIDE[key];
    } else {
      const clean = variants.filter(v => !hasMojibake(v.name));
      const pool  = clean.length ? clean : variants;
      pool.sort((a, b) => b.count - a.count);
      canonical = pool[0].name;
    }
    fabTypoClusters.push({ key, canonical, variants: variants.slice().sort((a,b)=>b.count-a.count) });
    for (const v of variants) if (v.name !== canonical) fabMap[v.name] = canonical;
  }

  // Hard merges
  const fabHardMerges = [];
  for (const [from, to] of Object.entries(FAB_HARD_MERGE)) {
    if (fabTotal.has(from)) {
      fabMap[from] = to;
      fabHardMerges.push({ from, to, rows: fabTotal.get(from) });
    }
  }

  // Country/region suffix detection.
  // Rule (user-specified): country-suffixed names (NESTLE COLOMBIA, UNILEVER ANDINA,
  // LOREAL PERU, ASPEN PERU, ...) are merged GLOBALLY into the bare form
  // (NESTLE, UNILEVER, L'OREAL, ASPEN). Country-specific manufacturer
  // attribution is handled separately in the marca_fabricante table.
  const effectiveOf = (n) => fabMap[n] || n;
  const effTotal = new Map();
  const effByPais = new Map();
  for (const [name, total] of fabTotal.entries()) {
    const eff = effectiveOf(name);
    effTotal.set(eff, (effTotal.get(eff) || 0) + total);
    const pm = fabByPais.get(name) || new Map();
    if (!effByPais.has(eff)) effByPais.set(eff, new Map());
    const dest = effByPais.get(eff);
    for (const [p, c] of pm.entries()) dest.set(p, (dest.get(p) || 0) + c);
  }
  const fabCountryDecisions = [];
  const effNames = Array.from(effTotal.keys());
  const seenPairs = new Set();
  for (const name of effNames) {
    const upper = name.toUpperCase();
    for (const tok of COUNTRY_TOKENS) {
      const re = new RegExp(`(^|[ -])${tok}$|^${tok}([ -]|$)`);
      if (!re.test(upper)) continue;
      const baseRaw = upper.replace(re, ' ').replace(/\s+/g, ' ').trim();
      if (!baseRaw) continue;
      const baseKey = normKey(baseRaw);
      const matches = effNames.filter(n => n !== name && normKey(n) === baseKey);
      for (const base of matches) {
        const pairKey = [name, base].sort().join('||');
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);
        const suffixed = name;
        const bare     = base;
        const paisSuf  = effByPais.get(suffixed) || new Map();
        const paisBare = effByPais.get(bare)     || new Map();
        const decision = {
          suffixed,  suffixed_rows: effTotal.get(suffixed), suffixed_pais: [...paisSuf.keys()],
          bare,      bare_rows:     effTotal.get(bare),     bare_pais:     [...paisBare.keys()],
          canonical: bare,
          action: 'MERGE_INTO_BARE',
        };
        for (const [raw] of fabTotal.entries()) {
          if (effectiveOf(raw) === suffixed) fabMap[raw] = bare;
        }
        if (fabTotal.has(suffixed)) fabMap[suffixed] = bare;
        fabCountryDecisions.push(decision);
        break;
      }
    }
  }

  // ─── MARCA PLAN ───────────────────────────────────────────────
  const { rows: marcaRowsRaw } = await c.query(`
    SELECT marca, SUM(n)::bigint AS n FROM (
      SELECT marca, COUNT(*)::int AS n FROM eci.sos    GROUP BY marca
      UNION ALL
      SELECT marca, COUNT(*)::int AS n FROM eci.search GROUP BY marca
    ) z
    GROUP BY marca
  `);
  const marcaTotal = new Map();
  for (const r of marcaRowsRaw) {
    if (!r.marca) continue;
    marcaTotal.set(r.marca, Number(r.n));
  }
  const marcaClusters = new Map();
  for (const [name, count] of marcaTotal.entries()) {
    const k = normKey(name);
    if (!k) continue;
    if (!marcaClusters.has(k)) marcaClusters.set(k, []);
    marcaClusters.get(k).push({ name, count });
  }
  const marcaMap = {};
  const marcaTypoClusters = [];
  for (const [key, variants] of marcaClusters.entries()) {
    if (variants.length < 2) continue;
    const clean = variants.filter(v => !hasMojibake(v.name));
    const pool  = clean.length ? clean : variants;
    pool.sort((a, b) => b.count - a.count);
    const canonical = pool[0].name;
    marcaTypoClusters.push({ key, canonical, variants: variants.slice().sort((a,b)=>b.count-a.count) });
    for (const v of variants) if (v.name !== canonical) marcaMap[v.name] = canonical;
  }

  // ─── CATEGORY CLUSTERS PER (pais, retail) ─────────────────────
  const { rows: catRowsRaw } = await c.query(`
    SELECT pais, retail, categoria, SUM(n)::bigint AS n FROM (
      SELECT pais, retail, categoria, COUNT(*)::int AS n FROM eci.sos    GROUP BY pais, retail, categoria
      UNION ALL
      SELECT pais, retail, categoria, COUNT(*)::int AS n FROM eci.search GROUP BY pais, retail, categoria
    ) z
    GROUP BY pais, retail, categoria
  `);
  // Bucket per (pais, retail) -> Map(key -> [{cat, count}])
  const catByRetail = new Map();
  for (const r of catRowsRaw) {
    if (!r.categoria) continue;
    const rk = `${r.pais}|${r.retail}`;
    if (!catByRetail.has(rk)) catByRetail.set(rk, new Map());
    const m = catByRetail.get(rk);
    const k = normKey(r.categoria);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push({ cat: r.categoria, count: Number(r.n) });
  }
  // Build proposed mapping (do NOT apply)
  const categoryPlan = []; // [{pais, retail, key, canonical, variants}]
  for (const [rk, byKey] of catByRetail.entries()) {
    const [pais, retail] = rk.split('|');
    for (const [key, variants] of byKey.entries()) {
      if (variants.length < 2) continue;
      const clean = variants.filter(v => !hasMojibake(v.cat));
      const pool  = clean.length ? clean : variants;
      pool.sort((a, b) => b.count - a.count);
      categoryPlan.push({
        pais, retail, key,
        canonical: pool[0].cat,
        variants: variants.slice().sort((a,b)=>b.count-a.count),
      });
    }
  }

  // ─── WRITE OUTPUTS ────────────────────────────────────────────
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    fabricantes: {
      map: fabMap,
      typo_clusters: fabTypoClusters,
      hard_merges: fabHardMerges,
      country_decisions: fabCountryDecisions,
    },
    marcas:      { map: marcaMap, typo_clusters: marcaTypoClusters },
    categories:  { per_retail: categoryPlan },
  }, null, 2));

  // human-readable
  const lines = [];
  const w = (...a) => lines.push(a.join(' '));
  w('===== FABRICANTES =====\n');
  w(`Typographic clusters with proposed canonical (${fabTypoClusters.length}):\n`);
  for (const c of fabTypoClusters.sort((a,b)=>
      b.variants.reduce((s,v)=>s+v.count,0) - a.variants.reduce((s,v)=>s+v.count,0))) {
    w(`  -> ${JSON.stringify(c.canonical)}`);
    for (const v of c.variants) {
      const mark = v.name === c.canonical ? '   (keep)' : '   merge ';
      w(`     ${mark} ${v.count.toString().padStart(10)}  ${JSON.stringify(v.name)}`);
    }
    w('');
  }
  w(`\nHard merges from the agreed table (${fabHardMerges.length}):\n`);
  for (const m of fabHardMerges) {
    w(`   ${m.rows.toString().padStart(10)}  ${JSON.stringify(m.from)}  ->  ${JSON.stringify(m.to)}`);
  }
  w(`\nCountry/region suffix pairs (${fabCountryDecisions.length}):\n`);
  for (const d of fabCountryDecisions) {
    w(`   [${d.action}]`);
    w(`     suffixed: ${JSON.stringify(d.suffixed)}  rows=${d.suffixed_rows}  pais=${d.suffixed_pais.join(',')}`);
    w(`     bare:     ${JSON.stringify(d.bare)}  rows=${d.bare_rows}  pais=${d.bare_pais.join(',')}`);
    w(`     -> ${JSON.stringify(d.canonical)}`);
    w('');
  }

  w('\n===== MARCAS =====\n');
  w(`Typographic clusters with proposed canonical (${marcaTypoClusters.length}):\n`);
  for (const c of marcaTypoClusters.sort((a,b)=>
      b.variants.reduce((s,v)=>s+v.count,0) - a.variants.reduce((s,v)=>s+v.count,0)).slice(0, 200)) {
    w(`  -> ${JSON.stringify(c.canonical)}`);
    for (const v of c.variants) {
      const mark = v.name === c.canonical ? '   (keep)' : '   merge ';
      w(`     ${mark} ${v.count.toString().padStart(10)}  ${JSON.stringify(v.name)}`);
    }
    w('');
  }
  if (marcaTypoClusters.length > 200) w(`  ... ${marcaTypoClusters.length - 200} more clusters in JSON`);

  w('\n===== CATEGORIES (per pais/retail) =====\n');
  // group by (pais, retail)
  const grouped = new Map();
  for (const c of categoryPlan) {
    const rk = `${c.pais} / ${c.retail}`;
    if (!grouped.has(rk)) grouped.set(rk, []);
    grouped.get(rk).push(c);
  }
  for (const [rk, clusters] of [...grouped.entries()].sort()) {
    w(`\n--- ${rk}  (${clusters.length} clusters) ---`);
    for (const c of clusters) {
      w(`  -> ${JSON.stringify(c.canonical)}`);
      for (const v of c.variants) {
        const mark = v.cat === c.canonical ? '   (keep)' : '   merge ';
        w(`     ${mark} ${v.count.toString().padStart(10)}  ${JSON.stringify(v.cat)}`);
      }
    }
  }

  fs.writeFileSync(OUT_TXT, lines.join('\n'));

  console.log(`Wrote plan to:\n  ${OUT_JSON}\n  ${OUT_TXT}`);
  console.log(`\nFabricantes: ${Object.keys(fabMap).length} mappings`);
  console.log(`Marcas:      ${Object.keys(marcaMap).length} mappings`);
  console.log(`Categories:  ${categoryPlan.length} clusters across ${grouped.size} (pais,retail) pairs`);

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
