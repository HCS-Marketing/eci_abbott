const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

async function main() {
  console.log("Creating materialized view mv_search_daily_fab...")
  
  await p.$executeRawUnsafe(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS eci.mv_search_daily_fab AS
    SELECT
      fecha::date AS fecha,
      pais,
      retail,
      search,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END AS fabricante,
      COUNT(*) FILTER (WHERE pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.search
    GROUP BY fecha::date, pais, retail, search, 
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END
    WITH DATA
  `)
  console.log("MV created.")

  console.log("Creating indexes...")
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ix_mv_search_daily_fab_fecha ON eci.mv_search_daily_fab (fecha)`)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ix_mv_search_daily_fab_fab ON eci.mv_search_daily_fab (fabricante)`)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ix_mv_search_daily_fab_search ON eci.mv_search_daily_fab (search)`)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ix_mv_search_daily_fab_pais ON eci.mv_search_daily_fab (pais)`)
  console.log("Indexes created.")

  // Also create a marca-level view for segmento/mercado filtering
  console.log("Creating materialized view mv_search_daily_marca...")
  await p.$executeRawUnsafe(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS eci.mv_search_daily_marca AS
    SELECT
      fecha::date AS fecha,
      pais,
      retail,
      search,
      marca,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END AS fabricante,
      COUNT(*) FILTER (WHERE pagina = 1) AS count_p1,
      COUNT(*) AS count_total
    FROM eci.search
    GROUP BY fecha::date, pais, retail, search, marca,
      CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 'ABBOTT' ELSE COALESCE(fabricante, 'MARCA LOCAL') END
    WITH DATA
  `)
  console.log("MV created.")

  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ix_mv_search_daily_marca_fecha ON eci.mv_search_daily_marca (fecha)`)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ix_mv_search_daily_marca_fab ON eci.mv_search_daily_marca (fabricante)`)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ix_mv_search_daily_marca_marca ON eci.mv_search_daily_marca (marca)`)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ix_mv_search_daily_marca_search ON eci.mv_search_daily_marca (search)`)
  console.log("All done!")

  // Row count
  const c1 = await p.$queryRawUnsafe("SELECT COUNT(*) as c FROM eci.mv_search_daily_fab")
  const c2 = await p.$queryRawUnsafe("SELECT COUNT(*) as c FROM eci.mv_search_daily_marca")
  console.log("mv_search_daily_fab rows:", c1[0].c)
  console.log("mv_search_daily_marca rows:", c2[0].c)

  await p.$disconnect()
}
main()
