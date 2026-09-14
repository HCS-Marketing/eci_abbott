const { Client } = require("pg")

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL

if (!connectionString) {
  console.error("Missing DATABASE_URL, POSTGRES_URL, or PRISMA_DATABASE_URL")
  process.exit(1)
}

const indexes = [
  {
    name: "idx_sos_base_fecha_retail_pais_categoria_fab_page",
    sql: `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sos_base_fecha_retail_pais_categoria_fab_page
      ON eci.sos (fecha, retail, pais, categoria, fabricante, pagina)
      WHERE fabricante IS NOT NULL
        AND COALESCE(UPPER(TRIM(fabricante)), '') <> 'MARCA LOCAL'
    `,
  },
  {
    name: "idx_sos_base_date_country_retail_categoria_fab_page",
    sql: `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sos_base_date_country_retail_categoria_fab_page
      ON eci.sos ((fecha::date), (UPPER(TRIM(pais))), retail, categoria, fabricante, pagina)
      WHERE fabricante IS NOT NULL
        AND COALESCE(UPPER(TRIM(fabricante)), '') <> 'MARCA LOCAL'
    `,
  },
  {
    name: "idx_sos_base_date_country_retail_subcategoria_fab_page",
    sql: `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sos_base_date_country_retail_subcategoria_fab_page
      ON eci.sos ((fecha::date), (UPPER(TRIM(pais))), retail, subcategoria, fabricante, pagina)
      WHERE fabricante IS NOT NULL
        AND COALESCE(UPPER(TRIM(fabricante)), '') <> 'MARCA LOCAL'
    `,
  },
  {
    name: "idx_sos_base_colombia_categories",
    sql: `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sos_base_colombia_categories
      ON eci.sos ((fecha::date), (UPPER(TRIM(pais))), retail, categoria_col, subcategoria_col, fabricante)
      WHERE fabricante IS NOT NULL
        AND COALESCE(UPPER(TRIM(fabricante)), '') <> 'MARCA LOCAL'
    `,
  },
  {
    name: "idx_sos_base_product_latest",
    sql: `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sos_base_product_latest
      ON eci.sos ((fecha::date), retail, (UPPER(TRIM(pais))), categoria, id, fabricante)
      INCLUDE (ranking, pagina, precio_venta, precio_neto)
      WHERE id IS NOT NULL
        AND precio_venta IS NOT NULL
        AND fabricante IS NOT NULL
        AND COALESCE(UPPER(TRIM(fabricante)), '') <> 'MARCA LOCAL'
    `,
  },
  {
    name: "idx_sos_base_ranking",
    sql: `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sos_base_ranking
      ON eci.sos ((fecha::date), retail, (UPPER(TRIM(pais))), categoria, fabricante, pagina)
      INCLUDE (ranking, id, marca)
      WHERE ranking IS NOT NULL
        AND fabricante IS NOT NULL
        AND COALESCE(UPPER(TRIM(fabricante)), '') <> 'MARCA LOCAL'
    `,
  },
  {
    name: "idx_search_base_fecha_retail_pais_search_fab_page",
    sql: `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_base_fecha_retail_pais_search_fab_page
      ON eci.search (fecha, retail, pais, search, fabricante, pagina)
      WHERE search IS NOT NULL
        AND TRIM(search) <> ''
        AND fabricante IS NOT NULL
        AND COALESCE(UPPER(TRIM(fabricante)), '') <> 'MARCA LOCAL'
    `,
  },
  {
    name: "idx_search_base_date_retail_pais_search_fab_page",
    sql: `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_base_date_retail_pais_search_fab_page
      ON eci.search ((fecha::date), retail, pais, search, fabricante, pagina)
      WHERE search IS NOT NULL
        AND TRIM(search) <> ''
        AND fabricante IS NOT NULL
        AND COALESCE(UPPER(TRIM(fabricante)), '') <> 'MARCA LOCAL'
    `,
  },
  {
    name: "idx_search_base_marca_breakdown",
    sql: `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_base_marca_breakdown
      ON eci.search ((fecha::date), retail, pais, search, marca, fabricante, pagina)
      WHERE search IS NOT NULL
        AND TRIM(search) <> ''
        AND marca IS NOT NULL
        AND fabricante IS NOT NULL
        AND COALESCE(UPPER(TRIM(fabricante)), '') <> 'MARCA LOCAL'
    `,
  },
]

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query("SET statement_timeout = 0")
    await client.query("SET lock_timeout = '10s'")

    for (const index of indexes) {
      const started = Date.now()
      console.log(`Creating ${index.name}...`)
      await client.query(index.sql)
      console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    }

    console.log("Base-table indexes are ready.")
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})