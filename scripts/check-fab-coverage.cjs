const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

async function main() {
  // Full contents of marca_fabricante
  const mf = await p.$queryRawUnsafe(`
    SELECT marca, pais, fabricante, segmento, mercado
    FROM eci.marca_fabricante
    ORDER BY fabricante, marca
  `)
  console.log(`\n=== eci.marca_fabricante (${mf.length} rows total) ===`)
  mf.forEach(r =>
    console.log(
      String(r.fabricante || "NULL").padEnd(28),
      String(r.pais || "  ").padEnd(4),
      r.marca
    )
  )

  // How many NULL-fabricante brands in eci.sos ARE covered by marca_fabricante?
  const coverage = await p.$queryRawUnsafe(`
    SELECT
      COALESCE(mf.fabricante, 'MISSING IN LOOKUP') AS resolved_fabricante,
      s.marca,
      COUNT(*)::int AS sos_rows
    FROM eci.sos s
    LEFT JOIN eci.marca_fabricante mf
      ON UPPER(s.marca) = UPPER(mf.marca)
    WHERE (s.fabricante IS NULL OR s.fabricante = '')
    GROUP BY mf.fabricante, s.marca
    ORDER BY sos_rows DESC
    LIMIT 60
  `)
  console.log("\n=== NULL-fabricante rows: what marca_fabricante resolves ===")
  coverage.forEach(r =>
    console.log(
      String(r.sos_rows).padStart(8),
      String(r.resolved_fabricante).padEnd(30),
      r.marca
    )
  )

  await p.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
