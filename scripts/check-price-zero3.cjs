const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Check eci.sos table for price=0 BENAVIDES rows
  const benv = await p.$queryRawUnsafe(`
    SELECT producto_id, titulo, marca, precio_venta, precio_neto, fecha::text, pagina, posicion
    FROM eci.sos
    WHERE retail = 'BENAVIDES' AND pais = 'MX' AND precio_venta = 0
    LIMIT 5
  `)
  console.log("=== eci.sos BENAVIDES price=0 ===")
  console.log(benv)

  // Check if same products have non-zero prices on other dates
  if (benv.length > 0) {
    const pid = benv[0].producto_id
    const withPrice = await p.$queryRawUnsafe(`
      SELECT fecha::text, precio_venta, precio_neto
      FROM eci.sos
      WHERE producto_id = $1 AND retail = 'BENAVIDES'
      ORDER BY fecha DESC LIMIT 10
    `, pid)
    console.log("\nSame product across dates:", withPrice)
  }

  // Check eci.sos CRUZ VERDE
  const cv = await p.$queryRawUnsafe(`
    SELECT producto_id, titulo, marca, precio_venta, precio_neto, fecha::text
    FROM eci.sos
    WHERE retail = 'CRUZ VERDE' AND pais = 'CO' AND precio_venta = 0
    LIMIT 5
  `)
  console.log("\n=== eci.sos CRUZ VERDE price=0 ===")
  console.log(cv)

  // Check columns of eci.sos
  const cols = await p.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'eci' AND table_name = 'sos'
    ORDER BY ordinal_position
  `)
  console.log("\n=== eci.sos columns ===")
  console.log(cols.map(c => `${c.column_name} (${c.data_type})`).join(', '))

  await p.$disconnect()
}
main()
