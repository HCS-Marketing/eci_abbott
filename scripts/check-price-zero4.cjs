const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // BENAVIDES price=0 samples from eci.sos
  const benv = await p.$queryRawUnsafe(`
    SELECT id, titulo, marca, fabricante, precio_venta, precio_neto, fecha::text, pagina, ranking
    FROM eci.sos
    WHERE retail = 'BENAVIDES' AND pais = 'MX' AND precio_venta = 0
    LIMIT 5
  `)
  console.log("=== eci.sos BENAVIDES price=0 ===")
  for (const r of benv) console.log(r)

  // Check if same product has price on other dates
  if (benv.length > 0) {
    const id = benv[0].id
    const hist = await p.$queryRawUnsafe(`
      SELECT fecha::text, precio_venta, precio_neto
      FROM eci.sos WHERE id = $1 AND retail = 'BENAVIDES'
      ORDER BY fecha DESC LIMIT 10
    `, id)
    console.log("\nHistory for product", id, ":")
    for (const r of hist) console.log(r)
  }

  // CRUZ VERDE price=0 samples
  const cv = await p.$queryRawUnsafe(`
    SELECT id, titulo, marca, fabricante, precio_venta, precio_neto, fecha::text, pagina, ranking
    FROM eci.sos
    WHERE retail = 'CRUZ VERDE' AND pais = 'CO' AND precio_venta = 0
    LIMIT 5
  `)
  console.log("\n=== eci.sos CRUZ VERDE price=0 ===")
  for (const r of cv) console.log(r)

  // Count total
  const total = await p.$queryRawUnsafe(`
    SELECT COUNT(*)::int as cnt FROM eci.sos WHERE precio_venta = 0
  `)
  console.log("\nTotal price=0 in eci.sos:", total[0].cnt)

  // Are there NULL prices too? 
  const nullP = await p.$queryRawUnsafe(`
    SELECT retail, COUNT(*)::int as cnt FROM eci.sos WHERE precio_venta IS NULL GROUP BY retail ORDER BY cnt DESC LIMIT 10
  `)
  console.log("\nNULL prices by retail:")
  for (const r of nullP) console.log(r)

  await p.$disconnect()
}
main()
