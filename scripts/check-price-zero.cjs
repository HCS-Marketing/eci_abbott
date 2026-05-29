const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

function ser(obj) {
  return JSON.stringify(obj, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2)
}

async function main() {
  // Distribution of price=0 by retail/country/date
  const dist = await p.$queryRawUnsafe(`
    SELECT retail, pais, fecha::text, COUNT(*) as cnt
    FROM eci.mv_sos_product_latest
    WHERE precio_venta = 0 OR precio_neto = 0
    GROUP BY retail, pais, fecha
    ORDER BY cnt DESC LIMIT 20
  `)
  console.log("=== Price=0 distribution ===")
  console.log(ser(dist))

  // Check the raw table too
  const raw = await p.$queryRawUnsafe(`
    SELECT retail, pais, fecha::text, COUNT(*) as cnt
    FROM eci.sos_raw
    WHERE (precio_venta = 0 OR precio_neto = 0) AND precio_venta IS NOT NULL
    GROUP BY retail, pais, fecha
    ORDER BY cnt DESC LIMIT 20
  `)
  console.log("\n=== Price=0 in sos_raw ===")
  console.log(ser(raw))

  // Total count
  const total = await p.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM eci.mv_sos_product_latest WHERE precio_venta = 0`)
  console.log("\n=== Total price=0 in MV ===", ser(total))

  // Check if fabricante has lowercase "Abbott"
  const abbott = await p.$queryRawUnsafe(`
    SELECT DISTINCT fabricante FROM eci.sos_raw
    WHERE fabricante ILIKE '%abbot%'
    ORDER BY fabricante
  `)
  console.log("\n=== Abbott variants in sos_raw ===")
  console.log(ser(abbott))

  const abbottMV = await p.$queryRawUnsafe(`
    SELECT DISTINCT fabricante FROM eci.mv_sos_product_latest
    WHERE fabricante ILIKE '%abbot%'
    ORDER BY fabricante
  `)
  console.log("\n=== Abbott variants in mv_sos_product_latest ===")
  console.log(ser(abbottMV))

  await p.$disconnect()
}
main()
