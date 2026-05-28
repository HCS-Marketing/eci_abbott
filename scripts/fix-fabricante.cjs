const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const ABBOTT_BRANDS = [
    'PEDIASURE', 'ENSURE', 'SIMILAC', 'GLUCERNA', 'PEDIALYTE',
    'ELECARE', 'ISOMIL', 'ABBOTT', 'NEPRO', 'OSMOLITE', 'ALITRAQ',
    'PEDIALACT', 'PURAMINO', 'NUTRAMIGEN'
  ]

  const brandList = ABBOTT_BRANDS.map(b => `'${b}'`).join(', ')

  // 1. Preview how many rows will be affected
  console.log("=== Preview: rows to fix ===")
  const preview = await prisma.$queryRawUnsafe(`
    SELECT 
      pais, retail, 
      COUNT(*) as rows_to_fix
    FROM eci.sos
    WHERE UPPER(marca) IN (${brandList})
      AND (fabricante IS NULL OR fabricante = '' OR UPPER(fabricante) = 'GENERICO')
    GROUP BY pais, retail
    ORDER BY pais, retail
  `)
  console.table(preview.map(r => ({ pais: r.pais, retail: r.retail, rows_to_fix: Number(r.rows_to_fix) })))

  const totalPreview = preview.reduce((s, r) => s + Number(r.rows_to_fix), 0)
  console.log(`\nTotal rows to update: ${totalPreview}`)

  // 2. Execute the UPDATE
  console.log("\n=== Updating fabricante to 'ABBOTT' where marca is Abbott brand and fabricante is NULL/empty/GENERICO ===")
  const result = await prisma.$queryRawUnsafe(`
    UPDATE eci.sos
    SET fabricante = 'ABBOTT'
    WHERE UPPER(marca) IN (${brandList})
      AND (fabricante IS NULL OR fabricante = '' OR UPPER(fabricante) = 'GENERICO')
  `)
  console.log("Update result:", result)

  // 3. Verify the fix
  console.log("\n=== Verification: page 1 Abbott SOS after fix ===")
  const verify = await prisma.$queryRawUnsafe(`
    SELECT retail, pais,
           COUNT(*) as total_p1,
           SUM(CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 1 ELSE 0 END) as abbott_p1,
           ROUND(100.0 * SUM(CASE WHEN UPPER(fabricante) LIKE '%ABBOT%' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as abbott_sos_pct
    FROM eci.sos
    WHERE pagina = 1
    GROUP BY retail, pais
    ORDER BY abbott_sos_pct ASC
  `)
  console.table(verify.map(r => ({
    retail: r.retail,
    pais: r.pais,
    total_p1: Number(r.total_p1),
    abbott_p1: Number(r.abbott_p1),
    sos_pct: Number(r.abbott_sos_pct) + '%'
  })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
