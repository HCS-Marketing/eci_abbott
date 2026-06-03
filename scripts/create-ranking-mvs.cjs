'use strict'
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
    if (m) process.env[m[1]] = m[2]
  }
}

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

const FAB_UNIFIED = `CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END`

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log('Connected to DB')

  console.log('Dropping old ranking MVs if any...')
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_ranking_daily_titulo CASCADE`)
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_ranking_daily_marca  CASCADE`)
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS eci.mv_ranking_daily_fab    CASCADE`)

  // ── mv_ranking_daily_fab ──────────────────────────────────────────────────
  console.log('Creating mv_ranking_daily_fab...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_ranking_daily_fab AS
    SELECT
      DATE(fecha)                                                       AS fecha,
      retail,
      pais,
      categoria,
      ${FAB_UNIFIED}                                                    AS fabricante,
      SUM(CASE WHEN pagina = 1 THEN ranking::numeric ELSE 0 END)       AS sum_ranking_p1,
      SUM(ranking::numeric)                                             AS sum_ranking_total
    FROM eci.sos
    WHERE ranking IS NOT NULL
    GROUP BY
      DATE(fecha), retail, pais, categoria,
      ${FAB_UNIFIED}
  `)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_fab (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_fab (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_fab (retail)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_fab (fecha, retail, pais, categoria)`)
  console.log('  mv_ranking_daily_fab OK')

  // ── mv_ranking_daily_marca ────────────────────────────────────────────────
  console.log('Creating mv_ranking_daily_marca...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_ranking_daily_marca AS
    SELECT
      DATE(fecha)                                                       AS fecha,
      retail,
      pais,
      categoria,
      marca,
      ${FAB_UNIFIED}                                                    AS fabricante,
      SUM(CASE WHEN pagina = 1 THEN ranking::numeric ELSE 0 END)       AS sum_ranking_p1,
      SUM(ranking::numeric)                                             AS sum_ranking_total
    FROM eci.sos
    WHERE ranking IS NOT NULL
    GROUP BY
      DATE(fecha), retail, pais, categoria, marca,
      ${FAB_UNIFIED}
  `)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_marca (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_marca (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_marca (marca)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_marca (fecha, retail, pais, categoria)`)
  console.log('  mv_ranking_daily_marca OK')

  // ── mv_ranking_daily_titulo ───────────────────────────────────────────────
  console.log('Creating mv_ranking_daily_titulo...')
  await client.query(`
    CREATE MATERIALIZED VIEW eci.mv_ranking_daily_titulo AS
    SELECT
      DATE(fecha)                                                       AS fecha,
      retail,
      pais,
      categoria,
      id                                                                AS titulo_id,
      MAX(titulo)                                                       AS titulo,
      ${FAB_UNIFIED}                                                    AS fabricante,
      SUM(CASE WHEN pagina = 1 THEN ranking::numeric ELSE 0 END)       AS sum_ranking_p1,
      SUM(ranking::numeric)                                             AS sum_ranking_total
    FROM eci.sos
    WHERE ranking IS NOT NULL AND id IS NOT NULL
    GROUP BY
      DATE(fecha), retail, pais, categoria, id,
      ${FAB_UNIFIED}
  `)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_titulo (fecha)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_titulo (fabricante)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_titulo (titulo_id)`)
  await client.query(`CREATE INDEX ON eci.mv_ranking_daily_titulo (fecha, retail, pais, categoria)`)
  console.log('  mv_ranking_daily_titulo OK')

  console.log('All ranking MVs created successfully!')
  await client.end()
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
