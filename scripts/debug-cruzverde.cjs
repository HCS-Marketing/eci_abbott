const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // What does Cruz Verde page 1 actually have for fabricante on 2026-05-27?
  console.log("=== CRUZ VERDE page 1 fabricante values (2026-05-27) ===")
  const cvFab = await prisma.$queryRawUnsafe(`
    SELECT fabricante, marca, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'CRUZ VERDE' AND fecha = '2026-05-27' AND pagina = 1
    GROUP BY fabricante, marca
    ORDER BY cnt DESC
    LIMIT 30
  `)
  console.table(cvFab.map(r => ({ fabricante: r.fabricante, marca: r.marca, count: Number(r.cnt) })))

  // What marca values are on Cruz Verde page 1?
  console.log("\n=== CRUZ VERDE page 1 all marcas ===")
  const cvMarcas = await prisma.$queryRawUnsafe(`
    SELECT marca, fabricante, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'CRUZ VERDE' AND fecha = '2026-05-27' AND pagina = 1
    GROUP BY marca, fabricante
    ORDER BY cnt DESC
  `)
  console.table(cvMarcas.map(r => ({ marca: r.marca, fabricante: r.fabricante, count: Number(r.cnt) })))

  // How many total Abbott-brand rows does Cruz Verde have across ALL pages for this date?
  console.log("\n=== CRUZ VERDE ALL pages Abbott brands (2026-05-27) ===")
  const cvAll = await prisma.$queryRawUnsafe(`
    SELECT marca, pagina, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'CRUZ VERDE' AND fecha = '2026-05-27'
      AND UPPER(marca) IN ('PEDIASURE','ENSURE','SIMILAC','GLUCERNA','PEDIALYTE','ABBOTT')
    GROUP BY marca, pagina
    ORDER BY marca, pagina
  `)
  console.table(cvAll.map(r => ({ marca: r.marca, pagina: Number(r.pagina), count: Number(r.cnt) })))

  // Check a specific known Abbott product from xlsx to see if it's in the DB
  console.log("\n=== CRUZ VERDE: sample rows with marca PEDIASURE ===")
  const sample = await prisma.$queryRawUnsafe(`
    SELECT titulo, marca, fabricante, pagina, "orden", fecha::text
    FROM eci.sos
    WHERE retail = 'CRUZ VERDE' AND UPPER(marca) = 'PEDIASURE'
    ORDER BY fecha DESC
    LIMIT 10
  `)
  console.table(sample.map(r => ({ titulo: (r.titulo||'').substring(0,50), marca: r.marca, fab: r.fabricante, pagina: Number(r.pagina), orden: Number(r.orden), fecha: r.fecha })))

  // Check TOTTUS pagina issue - xlsx says 92 on page 1, DB says 48
  // Look at what the xlsx "Página" column maps to in DB
  console.log("\n=== TOTTUS page distribution (2026-05-27) ===")
  const totPages = await prisma.$queryRawUnsafe(`
    SELECT pagina, ranking, COUNT(*) as cnt,
           COUNT(*) FILTER (WHERE fabricante = 'ABBOTT') as abbott
    FROM eci.sos
    WHERE retail = 'TOTTUS' AND fecha = '2026-05-27'
    GROUP BY pagina, ranking
    ORDER BY pagina
  `)
  console.table(totPages.map(r => ({ pagina: Number(r.pagina), ranking: Number(r.ranking), count: Number(r.cnt), abbott: Number(r.abbott) })))

  // Check Tottus categories
  console.log("\n=== TOTTUS categories (2026-05-27) ===")
  const totCats = await prisma.$queryRawUnsafe(`
    SELECT categoria, pagina, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'TOTTUS' AND fecha = '2026-05-27'
    GROUP BY categoria, pagina ORDER BY categoria, pagina
  `)
  console.table(totCats.map(r => ({ categoria: (r.categoria||'').substring(0,60), pagina: Number(r.pagina), count: Number(r.cnt) })))

  // Inkafarma: check xlsx categories that are missing from DB
  // The xlsx has: 'Nutrici├│n para Todos/Suplementos/Complementos/F├│rmula Infantil Especial' (18 items)
  // and 'Nutrici├│n para Todos/Suplementos Nutricionales/Geri├ítricos' (24 in xlsx, 3 in DB)
  console.log("\n=== INKAFARMA: check 'formula infantil especial' category ===")
  const inkaFIE = await prisma.$queryRawUnsafe(`
    SELECT categoria, pagina, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'INKAFARMA' AND fecha = '2026-05-27'
      AND LOWER(categoria) LIKE '%f_rmula infantil%'
    GROUP BY categoria, pagina ORDER BY categoria, pagina
  `)
  console.table(inkaFIE.map(r => ({ categoria: r.categoria, pagina: Number(r.pagina), count: Number(r.cnt) })))

  // Check 'geriátricos' category
  console.log("\n=== INKAFARMA: check 'geriatricos' category ===")
  const inkaGer = await prisma.$queryRawUnsafe(`
    SELECT categoria, pagina, COUNT(*) as cnt
    FROM eci.sos
    WHERE retail = 'INKAFARMA' AND fecha = '2026-05-27'
      AND LOWER(categoria) LIKE '%geri%'
    GROUP BY categoria, pagina ORDER BY categoria, pagina
  `)
  console.table(inkaGer.map(r => ({ categoria: r.categoria, pagina: Number(r.pagina), count: Number(r.cnt) })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
