// Migration script: Add segmento & mercado columns, create indexes and materialized views
// Run: DATABASE_URL=... node scripts/migrate-abbott.cjs

const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

// ── SEGMENTO MAPPING (marca_externa → segmento) ─────────────
// This is a subset of key Abbott brands. The full list is applied via UPDATE statements.
const SEGMENTO_MAP = {
  // Routine
  "NAN": "Routine", "NOVAMIL": "Routine", "Crecelac Firstep": "Routine", "Kabrita": "Routine",
  "NOVAMIL SYMB PREMI": "Routine", "NUTRIBABY": "Routine", "SIMILAC 3": "Routine", "Crecelac": "Routine",
  "Alpha-Pro": "Routine", "ALULA GOLD": "Routine", "NAN 3": "Routine", "PROGRESS GOLD": "Routine",
  "ALULA GOLD SMA": "Routine", "Nutrilon": "Routine", "NAN 1": "Routine", "GOOD START 1": "Routine",
  "GOOD START 2": "Routine", "DORALAC": "Routine", "NAN 1 OPTIMAL PRO": "Routine",
  "NAN 2 OPTIMAL PRO": "Routine", "Enfalac": "Routine", "FRISO GOLD 3": "Routine",
  "CRECELAC BEBE": "Routine", "NIDAL": "Routine", "NAN 3 OPTIMAL PRO": "Routine",
  "INFACARE": "Routine", "DORALAC 3": "Routine", "NIDAL ET2": "Routine",
  "NAN 3 OPTIPRO": "Routine", "SMILE UP 1": "Routine", "NAN OPTIMAL PRO 3": "Routine",
  "NAN SUPREME PRO 3": "Routine", "NAN 3 SUPREME PRO": "Routine", "NAN 2 SUPREME PRO": "Routine",
  "NAN 1 SUPREME PRO": "Routine", "Nidal 1": "Routine", "NAN OPTIMAL PRO 2": "Routine",
  "NAN SUPREME PRO 2": "Routine", "NAN OPTIMAL PRO 1": "Routine", "Good Start": "Routine",
  "Good Care": "Routine", "NAN 1 OPTIPRO": "Routine", "KABRITA ETAPA 1": "Routine",
  "KABRITA ETAPA 2": "Routine", "NIDAL ET1": "Routine", "NOVAMIL 1": "Routine",
  "NOVAMIL AE ETAPA 1": "Routine", "ENFAMIL PREMIUM": "Routine", "Enfamil Etapa 1": "Routine",
  "Enfamil 2": "Routine", "Enfamil Pro Select": "Routine", "Enfamil 1": "Routine",
  "ENFAM PRO SEL PREM": "Routine", "Enfamil Confort Pro 1": "Routine", "FRISOLAC ORO 1": "Routine",
  "FRISOLAC GOLD 2": "Routine", "SIMILAC 1": "Routine", "SIMILAC 2": "Routine",
  "SIMILAC ADVANCE": "Routine", "Similac 3 HMO": "Routine", "NUTRIBABY PREMIU 2": "Routine",
  "Nan Opti Pro": "Routine", "NIDAL BEBE 2": "Routine", "Kabrita 3": "Routine",
  "DORALAC 2": "Routine", "NOVAMIL Symbiotic": "Routine",
  "Novamil Symbiotic Premium 2": "Routine", "DORALAC 1": "Routine", "Crecelac 6": "Routine",
  "Nutrilon Premium+": "Routine", "SIMILAC Sensitive 5 HMO": "Routine",
  "ENFAGROW PREM PROM": "Routine", "ENFAGROW 3 PRO SELECT": "Routine", "Crecelac 1": "Routine",
  "NAN OPTIPRO 1": "Routine", "ENFAGROW 3 PREMIUM": "Routine", "NAN Optimalpro 1": "Routine",
  "Enfagrow 3": "Routine", "Friso Gold": "Routine", "ALULA GOLD PREMIUM": "Routine",
  "Crecelac Bebé": "Routine", "Friso GOLD ETAPA 3": "Routine", "NUTRILON PREMIUM+1": "Routine",
  "NUTRILON PREMIUM+3": "Routine", "capricare": "Routine", "NAN OPTIPRO 3": "Routine",
  "NAN SUPREM PRO ET3": "Routine", "NAN OPTIMALPRO 3": "Routine",
  "Enfagrow Premium Pro Select 3": "Routine", "NUTRIBABY PREMIU 3": "Routine",
  "Nutribaby 1": "Routine", "Nutribaby 2": "Routine", "Nutribaby Premium 3": "Routine",
  "LECHE SMA GOLD": "Routine", "ALULA PROGRESS GOL": "Routine",
  "Enfagrow Promental 3": "Routine", "Nutribaby Premium 2": "Routine",
  "Nutribaby Premium 1": "Routine", "NAN SUPREME PRO 1": "Routine",
  "Nan Supreme Pro": "Routine", "NUTRIBABY PREMIU 1": "Routine", "Alpha-Pro 3": "Routine",
  "NAN OPTIMAL PRO": "Routine", "PROMIL-GOLD": "Routine", "NAN 2 OPTIPRO": "Routine",
  "NAN SUPREM PRO ET1": "Routine", "NAN SUPREM PRO ET2": "Routine",
  "Enfamil Premium Pro Select 1": "Routine", "INFACARE EXPERT": "Routine",
  "ENFAGROW PROMENTAL ETAPA 3": "Routine", "Kabrita 1": "Routine", "Nutri Baby": "Routine",

  // Comfort
  "FRISOLAC GOLD COMF": "Comfort", "ENFAGROW PREM CONF": "Comfort",
  "ALULA GOLD COMFORT": "Comfort", "NOVAMIL AE1": "Comfort",
  "SIMILAC TOTAL COMFORT 2": "Comfort", "SIMILAC TOTAL COMFORT 1": "Comfort",
  "NOVAMIL COMFORT": "Comfort", "FRISO GOLD COM NEX": "Comfort",
  "NAN EXPERT PRO COM": "Comfort", "ALPHA-PRO ARACAE": "Comfort",
  "ALPHA-PRO COMFORT": "Comfort", "Nan Expert Pro Comfort Total 3": "Comfort",
  "Nan Expert Pro Comfort Total 1": "Comfort", "Nan Expert Pro Comfort Total 2": "Comfort",
  "Nan Expert Pro Comfort Plus +": "Comfort", "FRISOLAC GOLD": "Comfort",
  "NAN 2 EXP PRO CO T": "Comfort", "NAN EXPERT PRO CONFORT TOTAL 3": "Comfort",
  "NAN EXPERT PRO PREBIO AE": "Comfort", "NAN 1 CONF TOTAL": "Comfort",
  "NAN EXPERT PRO 2": "Comfort", "NAN 1 EXPERT PRO": "Comfort",
  "ENFAGROW 2 PREM CO": "Comfort", "Friso COMFORT NEXT 2": "Comfort",
  "Enfamil Confort 1": "Comfort", "Nan Expert Pro Confort": "Comfort",
  "Novamil Ae": "Comfort", "ALULA GOLD PRE COM": "Comfort",
  "NAN 3 CONF TOTAL": "Comfort", "NAN EXPERT PRO PREBIO": "Comfort",
  "NAN PRENAN": "Comfort", "NAN EXPERT PRO COMFORT PLUS": "Comfort",
  "NUTRILON PREM+ COM": "Comfort", "NAN EXPERTPRO 1": "Comfort",
  "NAN EXPERTPRO 2": "Comfort", "Nan Confort": "Comfort",
  "Nan Expert Pro Comfort 1": "Comfort", "NOVAMIL AE3": "Comfort",
  "NAN 3 EXP PRO CO T": "Comfort", "Frisolac Gold Comfort": "Comfort",
  "Enfamil Confort": "Comfort", "Enfagrow Confort": "Comfort",
  "Friso Gold Comfort": "Comfort", "Friso Gold Comfort Next": "Comfort",
  "NAN 1 EXP PRO CO T": "Comfort", "NAN CARE COMFORT": "Comfort",

  // Tolerance
  "ALPHA-PRO ELEMENTA": "Tolerance", "ENFAMIL-NUTRAMIGEN": "Tolerance",
  "Enfamil A.R.": "Tolerance", "NAN S/LACTOSA": "Tolerance",
  "NEOCATE JUNIOR": "Tolerance", "ALFAMINO": "Tolerance", "NEOCATE LCP": "Tolerance",
  "NAN EXPERT PRO AR": "Tolerance", "SIMILAC ARROZ ADVA": "Tolerance",
  "SIMILAC ISOMIL 2": "Tolerance", "ENFAMIL S/LACTOSA": "Tolerance",
  "PURAMINO": "Tolerance", "SIMILAC SENSITI LF": "Tolerance",
  "SIMILAC AR": "Tolerance", "SIMILAC ISOMIL 1": "Tolerance",
  "NOVAMIL RICE": "Tolerance", "ALTHERA": "Tolerance", "ALFARE": "Tolerance",
  "FRISOLAC GOLD HIPO": "Tolerance", "NOVAMIL ALLERNOVA": "Tolerance",
  "ALULA GOLD ARROZ": "Tolerance", "SIMILAC NEOSURE": "Tolerance",
  "NAN EXPERT PRO HA": "Tolerance", "Nan EXPERT PRO SIN LACTOSA": "Tolerance",
  "Nan EXPERT PRO SOYA": "Tolerance", "Pre NAN": "Tolerance",
  "ALTHERA HMO": "Tolerance", "ALFARE HMO": "Tolerance",
  "ALFAMINO HMO": "Tolerance", "ENFAMIL PREMATUROS": "Tolerance",
  "NUTRILON PREMIUM+ PEPTI": "Tolerance", "NUTRIBABY B.LACTOS": "Tolerance",
  "NAN EXPERTPRO SOYA": "Tolerance", "NAN EXPERT PRO": "Tolerance",
  "ALPHA-PRO RICE 3": "Tolerance", "Nan Expertpro H.A": "Tolerance",
  "NAN AR": "Tolerance", "ALULA GOLD PRE ARR": "Tolerance",
  "FRISOLAC Gold Sin Lactosa": "Tolerance", "ALTHÉRA": "Tolerance",
  "PRE-NAN": "Tolerance", "NAN H.A.1": "Tolerance", "SIMILAC SENSITIVE": "Tolerance",
  "SIMILAC TOTAL CARE": "Tolerance", "Frisolac Gold Hipoalergenico": "Tolerance",
  "DORALAC ARROZ 3": "Tolerance", "Neocate": "Tolerance",
  "SIMILAC ARROZ ADVANE": "Tolerance", "Frisolac Gold PEP AC": "Tolerance",
  "ISOMIL": "Tolerance", "ISOMIL 1": "Tolerance", "SIMILAC Isomil 1 Soya": "Tolerance",
  "Similac Arroz Advance": "Tolerance", "NAN SIN LACT": "Tolerance",
  "ENFANCE 4": "Tolerance", "BEU ALERGEN-H": "Tolerance", "BEU ALERGEN": "Tolerance",
  "beu": "Tolerance", "BEU SIN LACTOSA": "Tolerance", "BEU ALERGEN H": "Tolerance",
  "Beu Alergen-h": "Tolerance", "Nutribaby BL": "Tolerance",
  "FRISOLAC GO COM AR": "Tolerance",

  // S4
  "NIDO KINDER": "S4", "NIDO": "S4", "LECHE NIDO FORTICR": "S4",
  "NIDAL INFANTIL +1": "S4", "NIDO EXCELLA GOLD": "S4", "NIDO PREESCOLAR 2+": "S4",
  "NAN 4 OPTIMAL PRO": "S4", "Nan Optimal Pro 4": "S4", "Nidal Infantil": "S4",
  "LECHE NIDO 5 MAS": "S4", "NIDO PREESCOLAR 3+": "S4", "NAN OPTIMALPRO 4": "S4",
  "NAN 4 OPTIPRO": "S4", "Nido Kinder 1+": "S4", "LECHE NIDO": "S4",
  "Nido Pre Escolar 2+": "S4", "Nido FortiCrece": "S4", "NIDO Advance": "S4",
  "Nan Optimal Pro Etapa 4": "S4", "ENFAGROW 4 PRESCOL": "S4", "Enfagrow 4": "S4",

  // CNS Base
  "PEDIASURE PLUS": "CNS Base", "PEDIASURE": "CNS Base", "ASCENDA": "CNS Base",
  "FORTINI": "CNS Base", "ENFAGROW ADVANCE+": "CNS Base",

  // CNS 10+
  "PEDIASURE 10+": "CNS 10+",

  // Core Base
  "ENSURE": "Core Base", "ENSURE PRO-CARE": "Core Base", "ENTEREX": "Core Base",
  "BOOST ORIGINAL": "Core Base", "NUTRIBIO VITAL": "Core Base",
  "Ensure Procare": "Core Base", "FRESUBIN HPC": "Core Base",
  "FRESUBIN RNL": "Core Base", "FRESUBIN": "Core Base", "FRESUBIN FIBRA": "Core Base",
  "vitapromin": "Core Base",

  // Core ADV
  "ENTEREX PLUS": "Core ADV", "BOOST": "Core ADV", "ENSURE ADVANCE": "Core ADV",
  "BOOST HIGH PROTEIN": "Core ADV",

  // Diabetic
  "BOOST MENOS AZUCAR": "Diabetic", "GLUCERNA": "Diabetic", "ENTEREX DBCAL": "Diabetic",
  "NUTRIBIO SF": "Diabetic", "FRESENIUS KABI": "Diabetic", "FRESEKABI D": "Diabetic",
  "splenda": "Diabetic",

  // HOS
  "NEPRO-HP": "HOS", "PULMOCARE": "HOS", "ENTEREX IMX": "HOS", "PROSURE": "HOS",
  "nepro": "HOS", "ENTEREX H-RAMIFICA": "HOS", "NEPRO LOW PROT": "HOS",
  "Supportan": "HOS", "FRESUPPORT RNL": "HOS", "ALITRAQ": "HOS",

  // Prenatal
  "ENFAMOM": "Prenatal", "MATERNA": "Prenatal", "PHARMATON": "Prenatal",
  "ELEVIT": "Prenatal", "MATERPLUS": "Prenatal", "bellafem": "Prenatal",
  "OGESTAN": "Prenatal", "PREVITA MOM": "Prenatal", "BELLAFEM MATERNAL": "Prenatal",
  "PRENATAL": "Prenatal", "V-mater": "Prenatal", "REGENESIS MAX": "Prenatal",
  "GESTOMEG": "Prenatal", "BEBISTAN": "Prenatal", "PLENAFEM": "Prenatal",
  "GEADITE": "Prenatal", "GELCAVIT": "Prenatal", "ITALVIRON DHA": "Prenatal",
  "MATERFOL": "Prenatal", "Italvirón": "Prenatal",

  // ORS
  "ELECTROLIT": "ORS", "RECOVER": "ORS", "ELECTROLIFE ZERO": "ORS",

  // Probioticos
  "NAN CARE COMFORT": "Probioticos", "NAN CARE PROTECT": "Probioticos",

  // Organicas
  "LECHE HIPP ORGANIC": "Organicas", "Hipp Orgánico": "Organicas", "Hipp Comfort": "Organicas",
}

// ── MERCADO MAPPING (segmento → mercado) ─────────────────────
const MERCADO_MAP = {
  "CNS 10+": "CNS",
  "CNS Base": "CNS",
  "Core ADV": "Core",
  "Core Base": "Core",
  "Diabetic": "Diabetic",
  "Comfort": "IMF",
  "Routine": "IMF",
  "Tolerance": "IMF",
  "S4": "IMF",
  "Organicas": "IMF",
  "ORS": "ORS",
  "HOS": "HOS",
  "Prenatal": "Prenatal",
  "Probioticos": "Probioticos",
  "Otras": "Otras",
}

async function main() {
  console.log("=== Abbott ECI Migration ===\n")

  // 1. Add segmento and mercado columns to marca_fabricante
  console.log("1. Adding segmento and mercado columns...")
  try {
    await p.$executeRaw`ALTER TABLE eci.marca_fabricante ADD COLUMN IF NOT EXISTS segmento TEXT`
    await p.$executeRaw`ALTER TABLE eci.marca_fabricante ADD COLUMN IF NOT EXISTS mercado TEXT`
    console.log("   ✓ Columns added")
  } catch (e) {
    console.log("   Columns may already exist:", e.message)
  }

  // 2. Update segmento based on mapping
  console.log("\n2. Updating segmento values...")
  let updated = 0
  for (const [marca, segmento] of Object.entries(SEGMENTO_MAP)) {
    const result = await p.$executeRawUnsafe(
      `UPDATE eci.marca_fabricante SET segmento = $1 WHERE marca = $2 AND segmento IS NULL`,
      segmento, marca
    )
    updated += result
  }
  // Set "Otras" for everything not matched
  const otrasResult = await p.$executeRaw`
    UPDATE eci.marca_fabricante SET segmento = 'Otras' WHERE segmento IS NULL
  `
  console.log(`   ✓ Updated ${updated} rows with specific segmentos, ${otrasResult} set to 'Otras'`)

  // 3. Update mercado based on segmento
  console.log("\n3. Updating mercado values...")
  for (const [segmento, mercado] of Object.entries(MERCADO_MAP)) {
    await p.$executeRawUnsafe(
      `UPDATE eci.marca_fabricante SET mercado = $1 WHERE segmento = $2`,
      mercado, segmento
    )
  }
  // Any remaining
  await p.$executeRaw`UPDATE eci.marca_fabricante SET mercado = 'Otras' WHERE mercado IS NULL`
  console.log("   ✓ Mercado values updated")

  // 4. Create indexes on eci.sos for performance
  console.log("\n4. Creating indexes on eci.sos...")
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_sos_fecha ON eci.sos (fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_fecha_date ON eci.sos (DATE(fecha))`,
    `CREATE INDEX IF NOT EXISTS idx_sos_retail ON eci.sos (retail)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_marca ON eci.sos (marca)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_categoria ON eci.sos (categoria)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_pais ON eci.sos (pais)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_id ON eci.sos (id)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_pagina ON eci.sos (pagina)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_ranking ON eci.sos (ranking)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_fabricante ON eci.sos (fabricante)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_fecha_marca ON eci.sos (fecha, marca)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_fecha_retail ON eci.sos (fecha, retail)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_fecha_cat ON eci.sos (fecha, categoria)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_fecha_pais ON eci.sos (fecha, pais)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_composite ON eci.sos (fecha, categoria, retail, marca, pagina)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_date_id ON eci.sos (DATE(fecha), id)`,
  ]
  for (const sql of indexes) {
    try {
      await p.$executeRawUnsafe(sql)
      console.log(`   ✓ ${sql.split("idx_")[1]?.split(" ON")[0] || "index"}`)
    } catch (e) {
      console.log(`   ⚠ ${e.message}`)
    }
  }

  // 5. Create materialized views for common queries
  console.log("\n5. Creating materialized views...")

  // SOS Monthly: pre-aggregated monthly SOS by brand
  try {
    await p.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.sos_monthly CASCADE`)
    await p.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW eci.sos_monthly AS
      SELECT
        DATE_TRUNC('month', fecha)::date AS month,
        pais,
        categoria,
        retail,
        marca,
        fabricante,
        COUNT(*) AS total_appearances,
        COUNT(*) FILTER (WHERE pagina = 1) AS appearances_p1,
        ROUND(AVG(precio_venta::numeric), 0) AS avg_precio_venta,
        ROUND(AVG(ranking::numeric), 1) AS avg_ranking,
        COUNT(DISTINCT id) AS unique_products
      FROM eci.sos
      WHERE marca IS NOT NULL
      GROUP BY DATE_TRUNC('month', fecha)::date, pais, categoria, retail, marca, fabricante
    `)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sos_monthly_month ON eci.sos_monthly (month)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sos_monthly_marca ON eci.sos_monthly (marca)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sos_monthly_cat ON eci.sos_monthly (categoria)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sos_monthly_pais ON eci.sos_monthly (pais)`)
    console.log("   ✓ eci.sos_monthly created")
  } catch (e) {
    console.log("   ⚠ sos_monthly:", e.message)
  }

  // Categories timeseries: daily category totals for trend calculation
  try {
    await p.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.categories_timeseries CASCADE`)
    await p.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW eci.categories_timeseries AS
      SELECT
        DATE(fecha) AS day,
        pais,
        categoria,
        retail,
        COUNT(*) AS total_products,
        COUNT(*) FILTER (WHERE pagina = 1) AS products_p1,
        COUNT(DISTINCT marca) AS unique_brands,
        COUNT(DISTINCT id) AS unique_skus
      FROM eci.sos
      WHERE categoria IS NOT NULL
      GROUP BY DATE(fecha), pais, categoria, retail
    `)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cat_ts_day ON eci.categories_timeseries (day)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cat_ts_cat ON eci.categories_timeseries (categoria)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cat_ts_pais ON eci.categories_timeseries (pais)`)
    console.log("   ✓ eci.categories_timeseries created")
  } catch (e) {
    console.log("   ⚠ categories_timeseries:", e.message)
  }

  // Brand daily summary for SOS trends
  try {
    await p.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.brand_daily CASCADE`)
    await p.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW eci.brand_daily AS
      SELECT
        DATE(fecha) AS day,
        pais,
        categoria,
        retail,
        marca,
        fabricante,
        COUNT(*) AS total_appearances,
        COUNT(*) FILTER (WHERE pagina = 1) AS appearances_p1,
        ROUND(AVG(ranking::numeric), 1) AS avg_ranking,
        ROUND(AVG(precio_venta::numeric), 0) AS avg_precio
      FROM eci.sos
      WHERE marca IS NOT NULL
      GROUP BY DATE(fecha), pais, categoria, retail, marca, fabricante
    `)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_brand_daily_day ON eci.brand_daily (day)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_brand_daily_marca ON eci.brand_daily (marca)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_brand_daily_cat ON eci.brand_daily (categoria)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_brand_daily_pais ON eci.brand_daily (pais)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_brand_daily_composite ON eci.brand_daily (day, pais, categoria, retail)`)
    console.log("   ✓ eci.brand_daily created")
  } catch (e) {
    console.log("   ⚠ brand_daily:", e.message)
  }

  // Latest snapshot: most recent data per product for quick "today" queries
  try {
    await p.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS eci.latest_snapshot CASCADE`)
    await p.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW eci.latest_snapshot AS
      WITH latest AS (
        SELECT MAX(DATE(fecha)) AS max_date FROM eci.sos
      )
      SELECT
        s.id, s.pais, s.titulo, s.marca, s.fabricante,
        s.precio_venta, s.precio_neto, s.descuento,
        s.categoria, s.subcategoria, s.retail,
        s.ranking, s.pagina, s.url_producto, s.presentacion, s.promocion
      FROM eci.sos s, latest
      WHERE DATE(s.fecha) = latest.max_date
    `)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_latest_id ON eci.latest_snapshot (id)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_latest_marca ON eci.latest_snapshot (marca)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_latest_cat ON eci.latest_snapshot (categoria)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_latest_retail ON eci.latest_snapshot (retail)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_latest_pais ON eci.latest_snapshot (pais)`)
    console.log("   ✓ eci.latest_snapshot created")
  } catch (e) {
    console.log("   ⚠ latest_snapshot:", e.message)
  }

  // Index on marca_fabricante
  try {
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_mf_marca ON eci.marca_fabricante (marca)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_mf_segmento ON eci.marca_fabricante (segmento)`)
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_mf_mercado ON eci.marca_fabricante (mercado)`)
    console.log("   ✓ marca_fabricante indexes created")
  } catch (e) {
    console.log("   ⚠ marca_fabricante indexes:", e.message)
  }

  console.log("\n=== Migration complete! ===")
  console.log("\nTo refresh materialized views (run periodically):")
  console.log("  REFRESH MATERIALIZED VIEW CONCURRENTLY eci.sos_monthly;")
  console.log("  REFRESH MATERIALIZED VIEW CONCURRENTLY eci.categories_timeseries;")
  console.log("  REFRESH MATERIALIZED VIEW CONCURRENTLY eci.brand_daily;")
  console.log("  REFRESH MATERIALIZED VIEW CONCURRENTLY eci.latest_snapshot;")

  await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
