/**
 * load-products-master.cjs
 * Reads "Catalogo Final  11-06-2026_DShelf.xlsx" and upserts all rows into
 * eci.products_master, keyed on ean.
 *
 * Table schema created here if it doesn't exist yet.
 */
const { Client } = require('pg')
const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const DB = env.match(/DATABASE_URL="?([^"\r\n]+)"?/)[1]

;(async () => {
  const c = new Client({ connectionString: DB })
  await c.connect()

  // ── 1. Create table (drop & recreate to ensure correct schema) ──
  await c.query(`DROP TABLE IF EXISTS eci.products_master`)
  await c.query(`
    CREATE TABLE eci.products_master (
      ean           text        PRIMARY KEY,
      local_sku     text,
      asin          text,
      meli_id       text,
      sap_sku       text,
      walmart_id    text,
      type          text,
      volumen       text,
      brand         text,
      sub_brand     text,
      region_category text,
      category      text,
      descripcion   text,
      updated_at    timestamptz NOT NULL DEFAULT now()
    )
  `)
  console.log('Table eci.products_master ready.')

  // ── 2. Read xlsx ──────────────────────────────────────────
  const xlsxPath = path.join(__dirname, '..', 'Catalogo Final  11-06-2026_DShelf.xlsx')
  const wb = XLSX.readFile(xlsxPath)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { defval: null })
  console.log(`Read ${rows.length} rows from xlsx.`)

  // ── 3. Upsert each row ────────────────────────────────────
  let inserted = 0, updated = 0, skipped = 0

  for (const row of rows) {
    const ean = row['EAN/GTIN'] != null ? String(row['EAN/GTIN']).trim() : null
    if (!ean) { skipped++; continue }

    const local_sku       = row['Local']           != null ? String(row['Local']).trim()           : null
    const asin            = row['ASIN']             != null ? String(row['ASIN']).trim()            : null
    const meli_id         = row['MeLi']             != null ? String(row['MeLi']).trim()            : null
    const sap_sku         = row['SAP SKU']          != null ? String(row['SAP SKU']).trim()         : null
    const walmart_id      = row['WalMart']          != null ? String(row['WalMart']).trim()         : null
    const type            = row['Type']             != null ? String(row['Type']).trim()            : null
    const volumen         = row['Volumen']          != null ? String(row['Volumen']).trim()         : null
    const brand           = row['Brand']            != null ? String(row['Brand']).trim()           : null
    const sub_brand       = row['Sub Brand']        != null ? String(row['Sub Brand']).trim()       : null
    const region_category = row['Region Category'] != null ? String(row['Region Category']).trim() : null
    const category        = row['Category ']       != null ? String(row['Category ']).trim()       : null
    const descripcion     = row['Descripcion']      != null ? String(row['Descripcion']).trim()     : null

    const res = await c.query(`
      INSERT INTO eci.products_master
        (ean, local_sku, asin, meli_id, sap_sku, walmart_id, type, volumen,
         brand, sub_brand, region_category, category, descripcion, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
      ON CONFLICT (ean) DO UPDATE SET
        local_sku       = EXCLUDED.local_sku,
        asin            = EXCLUDED.asin,
        meli_id         = EXCLUDED.meli_id,
        sap_sku         = EXCLUDED.sap_sku,
        walmart_id      = EXCLUDED.walmart_id,
        type            = EXCLUDED.type,
        volumen         = EXCLUDED.volumen,
        brand           = EXCLUDED.brand,
        sub_brand       = EXCLUDED.sub_brand,
        region_category = EXCLUDED.region_category,
        category        = EXCLUDED.category,
        descripcion     = EXCLUDED.descripcion,
        updated_at      = now()
      RETURNING (xmax = 0) AS was_insert
    `, [ean, local_sku, asin, meli_id, sap_sku, walmart_id, type, volumen,
        brand, sub_brand, region_category, category, descripcion])

    if (res.rows[0].was_insert) inserted++; else updated++
  }

  console.log(`Done. Inserted: ${inserted}, Updated: ${updated}, Skipped (no EAN): ${skipped}`)

  // ── 4. Quick verification ─────────────────────────────────
  const cnt = await c.query('SELECT COUNT(*) AS n FROM eci.products_master')
  console.log(`Total rows in eci.products_master: ${cnt.rows[0].n}`)

  await c.end()
  process.exit(0)
})().catch(e => { console.error('Error:', e.message); process.exit(1) })
