/**
 * diagnose-data-quality.cjs
 * Read-only diagnostic. Reports what needs cleanup so we can plan
 * standardization rules together before applying anything destructive.
 *
 *   node scripts/diagnose-data-quality.cjs
 */
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

const DB = fs.readFileSync(
  path.join(__dirname, '..', '.env.local'), 'utf8'
).match(/DATABASE_URL="([^"]+)"/)?.[1];

function table(rows, max = 25) {
  if (!rows.length) { console.log('  (no rows)'); return; }
  console.table(rows.slice(0, max));
  if (rows.length > max) console.log(`  ... ${rows.length - max} more rows`);
}

(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();

  // ─── 1. FABRICANTES ────────────────────────────────────────────
  console.log('\n========== 1. FABRICANTES (distinct, sorted by row count) ==========');
  for (const tbl of ['eci.sos', 'eci.search']) {
    console.log(`\n--- ${tbl} ---`);
    const { rows } = await c.query(`
      SELECT fabricante, COUNT(*)::int AS rows
      FROM ${tbl}
      GROUP BY fabricante
      ORDER BY rows DESC
      LIMIT 50
    `);
    table(rows, 50);
  }

  // Look-alike clusters (case/accent/whitespace variants)
  console.log('\n--- Fabricante look-alikes (normalized key collisions) ---');
  const { rows: fabClusters } = await c.query(`
    WITH all_fabs AS (
      SELECT fabricante, COUNT(*)::int AS n FROM eci.sos GROUP BY fabricante
      UNION ALL
      SELECT fabricante, COUNT(*)::int AS n FROM eci.search GROUP BY fabricante
    ),
    norm AS (
      SELECT fabricante,
             UPPER(REGEXP_REPLACE(unaccent(COALESCE(fabricante, '')), '[^A-Z0-9]', '', 'gi')) AS key,
             SUM(n) AS n
      FROM all_fabs
      GROUP BY fabricante
    )
    SELECT key,
           STRING_AGG(DISTINCT fabricante, ' | ' ORDER BY fabricante) AS variants,
           SUM(n)::int AS total_rows
    FROM norm
    WHERE key != ''
    GROUP BY key
    HAVING COUNT(DISTINCT fabricante) > 1
    ORDER BY total_rows DESC
    LIMIT 50
  `).catch(async () => {
    // unaccent may not be installed — fallback
    return c.query(`
      WITH all_fabs AS (
        SELECT fabricante FROM eci.sos
        UNION ALL
        SELECT fabricante FROM eci.search
      ),
      norm AS (
        SELECT fabricante,
               UPPER(REGEXP_REPLACE(COALESCE(fabricante, ''), '[^A-Za-z0-9]', '', 'g')) AS key
        FROM all_fabs
      )
      SELECT key,
             STRING_AGG(DISTINCT fabricante, ' | ' ORDER BY fabricante) AS variants,
             COUNT(*)::int AS total_rows
      FROM norm
      WHERE key != ''
      GROUP BY key
      HAVING COUNT(DISTINCT fabricante) > 1
      ORDER BY total_rows DESC
      LIMIT 50
    `);
  });
  table(fabClusters, 50);

  // ─── 2. MARCAS (top distinct + look-alikes) ────────────────────
  console.log('\n========== 2. MARCAS (top 100 by row count) ==========');
  const { rows: marcas } = await c.query(`
    WITH all_marcas AS (
      SELECT marca, COUNT(*)::int AS n FROM eci.sos GROUP BY marca
      UNION ALL
      SELECT marca, COUNT(*)::int AS n FROM eci.search GROUP BY marca
    )
    SELECT marca, SUM(n)::int AS total_rows
    FROM all_marcas
    GROUP BY marca
    ORDER BY total_rows DESC
    LIMIT 100
  `);
  table(marcas, 100);

  console.log('\n--- Marca look-alikes (normalized key collisions) ---');
  const { rows: marcaClusters } = await c.query(`
    WITH all_marcas AS (
      SELECT marca FROM eci.sos WHERE marca IS NOT NULL
      UNION ALL
      SELECT marca FROM eci.search WHERE marca IS NOT NULL
    ),
    norm AS (
      SELECT marca,
             UPPER(REGEXP_REPLACE(COALESCE(marca, ''), '[^A-Za-z0-9]', '', 'g')) AS key
      FROM all_marcas
    )
    SELECT key,
           STRING_AGG(DISTINCT marca, ' | ' ORDER BY marca) AS variants,
           COUNT(*)::int AS total_rows
    FROM norm
    WHERE key != ''
    GROUP BY key
    HAVING COUNT(DISTINCT marca) > 1
    ORDER BY total_rows DESC
    LIMIT 30
  `);
  table(marcaClusters, 30);

  // ─── 3. CATEGORIES per retail ───────────────────────────────────
  console.log('\n========== 3. CATEGORIES per retail (eci.sos) ==========');
  const { rows: catsByRetail } = await c.query(`
    SELECT pais, retail, categoria, COUNT(*)::int AS rows
    FROM eci.sos
    WHERE categoria IS NOT NULL
    GROUP BY pais, retail, categoria
    ORDER BY pais, retail, rows DESC
  `);
  // group by retail for readability
  const byRetail = {};
  for (const r of catsByRetail) {
    const k = `${r.pais} / ${r.retail}`;
    byRetail[k] = byRetail[k] || [];
    byRetail[k].push({ categoria: r.categoria, rows: r.rows });
  }
  for (const [k, list] of Object.entries(byRetail)) {
    console.log(`\n--- ${k} (${list.length} distinct categorias) ---`);
    table(list, 30);
  }

  // ─── 4. DATE & COLUMN-SHIFT ANOMALIES ──────────────────────────
  console.log('\n========== 4. DATE / COLUMN ANOMALIES ==========');

  console.log('\n--- Rows with fecha outside expected range ---');
  for (const tbl of ['eci.sos', 'eci.search']) {
    const { rows } = await c.query(`
      SELECT '${tbl}' AS tbl, fecha::date AS fecha, COUNT(*)::int AS rows
      FROM ${tbl}
      WHERE fecha < '2025-01-01' OR fecha > CURRENT_DATE + INTERVAL '1 day'
      GROUP BY fecha
      ORDER BY rows DESC
      LIMIT 20
    `);
    if (rows.length) table(rows, 20);
    else console.log(`  ${tbl}: none`);
  }

  console.log('\n--- Rows where retail looks like a date / number / weird ---');
  for (const tbl of ['eci.sos', 'eci.search']) {
    const { rows } = await c.query(`
      SELECT '${tbl}' AS tbl, retail, COUNT(*)::int AS rows
      FROM ${tbl}
      WHERE retail ~ '^[0-9]' OR retail ~ '\\d{4}-\\d{2}-\\d{2}' OR LENGTH(retail) < 3
      GROUP BY retail
      ORDER BY rows DESC
      LIMIT 20
    `);
    if (rows.length) table(rows, 20);
    else console.log(`  ${tbl}: none`);
  }

  console.log('\n--- Rows where titulo looks like a number/price/date ---');
  for (const tbl of ['eci.sos', 'eci.search']) {
    const { rows } = await c.query(`
      SELECT '${tbl}' AS tbl, titulo, COUNT(*)::int AS rows
      FROM ${tbl}
      WHERE titulo ~ '^[0-9.,]+$' OR titulo ~ '^\\d{4}-\\d{2}-\\d{2}'
      GROUP BY titulo
      ORDER BY rows DESC
      LIMIT 20
    `);
    if (rows.length) table(rows, 20);
    else console.log(`  ${tbl}: none`);
  }

  console.log('\n--- Rows where ranking/orden/pagina are absurd ---');
  for (const tbl of ['eci.sos', 'eci.search']) {
    const { rows } = await c.query(`
      SELECT '${tbl}' AS tbl,
        SUM(CASE WHEN pagina > 50 THEN 1 ELSE 0 END)::int AS pagina_gt_50,
        SUM(CASE WHEN orden > 1000 THEN 1 ELSE 0 END)::int AS orden_gt_1000,
        SUM(CASE WHEN ranking > 10000 THEN 1 ELSE 0 END)::int AS ranking_gt_10k,
        SUM(CASE WHEN ranking < 0 THEN 1 ELSE 0 END)::int AS ranking_neg
      FROM ${tbl}
    `);
    table(rows);
  }

  // ─── 5. PRICING OUTLIERS ────────────────────────────────────────
  console.log('\n========== 5. PRICING OUTLIERS ==========');

  console.log('\n--- Rows with precio_venta = 0 or negative ---');
  for (const tbl of ['eci.sos', 'eci.search']) {
    const { rows } = await c.query(`
      SELECT '${tbl}' AS tbl, pais,
        SUM(CASE WHEN precio_venta = 0 THEN 1 ELSE 0 END)::int AS precio_zero,
        SUM(CASE WHEN precio_venta < 0 THEN 1 ELSE 0 END)::int AS precio_neg,
        SUM(CASE WHEN precio_venta IS NULL THEN 1 ELSE 0 END)::int AS precio_null,
        COUNT(*)::int AS total
      FROM ${tbl}
      GROUP BY pais
      ORDER BY pais
    `);
    table(rows);
  }

  console.log('\n--- Price extremes vs category median (top 20 most-extreme rows) ---');
  // Compute IQR per (pais, retail, categoria) and find outliers beyond 3x IQR
  const { rows: extremes } = await c.query(`
    WITH stats AS (
      SELECT pais, retail, categoria,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY precio_venta) AS q1,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY precio_venta) AS med,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY precio_venta) AS q3,
        COUNT(*)::int AS n
      FROM eci.sos
      WHERE precio_venta > 0 AND categoria IS NOT NULL
      GROUP BY pais, retail, categoria
      HAVING COUNT(*) >= 20
    ),
    flagged AS (
      SELECT s.pais, s.retail, s.categoria, s.titulo,
        s.precio_venta::numeric(12,2),
        st.med::numeric(12,2) AS category_median,
        ROUND((s.precio_venta / NULLIF(st.med, 0))::numeric, 1) AS times_median,
        s.fecha::date
      FROM eci.sos s
      JOIN stats st USING (pais, retail, categoria)
      WHERE s.precio_venta > 0
        AND (s.precio_venta > st.q3 + 5 * (st.q3 - st.q1)
          OR s.precio_venta < GREATEST(0.01, st.q1 - 5 * (st.q3 - st.q1)))
    )
    SELECT * FROM flagged
    ORDER BY GREATEST(times_median, 1.0 / NULLIF(times_median, 0)) DESC NULLS LAST
    LIMIT 25
  `);
  table(extremes, 25);

  console.log('\n--- Per-(pais, retail) overall pricing summary ---');
  const { rows: priceSummary } = await c.query(`
    SELECT pais, retail,
      COUNT(*)::int AS rows,
      ROUND(MIN(precio_venta)::numeric, 2) AS min,
      ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY precio_venta)::numeric, 2) AS median,
      ROUND(MAX(precio_venta)::numeric, 2) AS max
    FROM eci.sos
    WHERE precio_venta > 0
    GROUP BY pais, retail
    ORDER BY pais, retail
  `);
  table(priceSummary, 50);

  await c.end();
  console.log('\nDiagnostic complete.\n');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
