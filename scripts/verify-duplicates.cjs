const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Check if "duplicates" actually have different data in other columns
  // Focus on the worst case: FARMACIA DEL AHORRO, Fórmula Láctea, page 1, order 1
  console.log('=== SAMPLE: FARMACIA DEL AHORRO, 2025-12-15, Fórmula Láctea, page 1, orden 1 ===')
  console.log('(Key: fecha + retail + skuid + categoria + pagina + orden)\n')
  
  const sample = await p.$queryRawUnsafe(`
    SELECT titulo, marca, fabricante, precio, precio_venta, skuid, ranking
    FROM eci.sos
    WHERE retail = 'FARMACIA DEL AHORRO' 
      AND fecha = '2025-12-15' 
      AND categoria LIKE '%rmula L%ctea%'
      AND pagina = 1 AND orden = 1
    LIMIT 10
  `)
  console.table(sample.map(r => ({
    titulo: (r.titulo || '').substring(0, 50),
    marca: r.marca,
    fabricante: r.fabricante,
    precio: r.precio ? Number(r.precio) : null,
    skuid: r.skuid || '(empty)',
    ranking: r.ranking ? Number(r.ranking) : null
  })))
  console.log(`Total rows for this key: ${sample.length} shown (of 193 reported)\n`)

  // Check DISTINCT titulos for same key
  console.log('=== DISTINCT titulos for this same key ===')
  const distinctTitulos = await p.$queryRawUnsafe(`
    SELECT DISTINCT titulo
    FROM eci.sos
    WHERE retail = 'FARMACIA DEL AHORRO' 
      AND fecha = '2025-12-15' 
      AND categoria LIKE '%rmula L%ctea%'
      AND pagina = 1 AND orden = 1
  `)
  console.log(`Distinct titles: ${distinctTitulos.length}`)
  distinctTitulos.forEach(r => console.log(' ', (r.titulo || '').substring(0, 80)))

  // Broader check: for all "duplicates", how many have truly identical rows vs different data?
  console.log('\n=== BROADER CHECK: Are duplicates truly identical? ===')
  const broadCheck = await p.$queryRawUnsafe(`
    WITH dup_keys AS (
      SELECT fecha, retail, skuid, categoria, pagina, orden
      FROM eci.sos
      GROUP BY fecha, retail, skuid, categoria, pagina, orden
      HAVING COUNT(*) > 1
      LIMIT 100
    ),
    dup_rows AS (
      SELECT s.fecha, s.retail, s.skuid, s.categoria, s.pagina, s.orden, s.titulo, s.marca, s.precio
      FROM eci.sos s
      JOIN dup_keys d ON s.fecha = d.fecha AND s.retail = d.retail 
        AND COALESCE(s.skuid,'') = COALESCE(d.skuid,'')
        AND s.categoria = d.categoria AND s.pagina = d.pagina AND s.orden = d.orden
    )
    SELECT 
      COUNT(*) as total_dup_rows,
      COUNT(DISTINCT (titulo, marca, precio)::text) as distinct_products
    FROM dup_rows
  `)
  console.table(broadCheck)

  // Check a CO retailer with duplicates to see if same pattern
  console.log('\n=== RAPPI CO duplicates sample ===')
  const rappiDups = await p.$queryRawUnsafe(`
    SELECT fecha, categoria, pagina, orden, skuid, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'RAPPI' AND pais = 'CO'
    GROUP BY fecha, categoria, pagina, orden, skuid
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 5
  `)
  console.table(rappiDups.map(r => ({
    fecha: r.fecha, cat: (r.categoria||'').substring(0,30),
    pag: Number(r.pagina), ord: Number(r.orden), 
    skuid: (r.skuid||'').substring(0,20), cnt: Number(r.cnt)
  })))

  // For one of those, check if titulos differ
  if (rappiDups.length > 0) {
    const d = rappiDups[0]
    const rappiRows = await p.$queryRawUnsafe(`
      SELECT titulo, marca, fabricante, precio, skuid
      FROM eci.sos
      WHERE retail = 'RAPPI' AND pais = 'CO'
        AND fecha = $1 AND categoria = $2 AND pagina = $3 AND orden = $4
      LIMIT 5
    `, d.fecha, d.categoria, d.pagina, d.orden)
    console.log('\nRappi dup detail:')
    console.table(rappiRows.map(r => ({
      titulo: (r.titulo||'').substring(0,50), marca: r.marca, 
      fab: r.fabricante, precio: r.precio ? Number(r.precio) : null,
      skuid: (r.skuid||'').substring(0,20)
    })))
  }

  // Key question: what % of "duplicate" groups have ALL rows identical vs different?
  console.log('\n=== IDENTITY CHECK: fully identical rows vs merely same key ===')
  const identityCheck = await p.$queryRawUnsafe(`
    WITH dup_keys AS (
      SELECT fecha, retail, pais, skuid, categoria, pagina, orden, COUNT(*) as key_cnt
      FROM eci.sos
      GROUP BY fecha, retail, pais, skuid, categoria, pagina, orden
      HAVING COUNT(*) > 1
    ),
    full_dedup AS (
      SELECT fecha, retail, pais, skuid, categoria, pagina, orden, titulo, marca, fabricante, precio, COUNT(*) as full_cnt
      FROM eci.sos
      GROUP BY fecha, retail, pais, skuid, categoria, pagina, orden, titulo, marca, fabricante, precio
      HAVING COUNT(*) > 1
    )
    SELECT 
      (SELECT COUNT(*) FROM dup_keys) as groups_same_key,
      (SELECT SUM(key_cnt - 1) FROM dup_keys) as extra_by_key,
      (SELECT COUNT(*) FROM full_dedup) as groups_fully_identical,
      (SELECT SUM(full_cnt - 1) FROM full_dedup) as extra_fully_identical
  `)
  console.table(identityCheck.map(r => ({
    groups_same_key: Number(r.groups_same_key),
    extra_by_key: Number(r.extra_by_key),
    groups_fully_identical: Number(r.groups_fully_identical),
    extra_fully_identical: Number(r.extra_fully_identical)
  })))
}

main().catch(console.error).finally(() => p.$disconnect())
