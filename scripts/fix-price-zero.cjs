const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

async function main() {
  // Fix Cruz Verde: use precio_neto where precio_venta=0
  const updated = await p.$executeRawUnsafe(
    "UPDATE eci.sos SET precio_venta = precio_neto WHERE precio_venta = 0 AND precio_neto > 0 AND retail = 'CRUZ VERDE'"
  )
  console.log("Cruz Verde rows updated:", updated)

  // For Benavides: set precio_venta to NULL where both are 0 (truly priceless)
  const nulled = await p.$executeRawUnsafe(
    "UPDATE eci.sos SET precio_venta = NULL WHERE precio_venta = 0 AND (precio_neto = 0 OR precio_neto IS NULL) AND retail = 'BENAVIDES'"
  )
  console.log("Benavides rows nulled:", nulled)

  await p.$disconnect()
}

main()
