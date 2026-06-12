const {Client} = require('pg')
const fs = require('fs')
const path = require('path')

const DB = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').match(/DATABASE_URL="([^"]+)"/)?.[1]
const c = new Client({connectionString: DB})

c.connect().then(async () => {
  const r = await c.query(`
    SELECT 'sos' AS t, pais, MAX(fecha::date)::text AS max_d FROM eci.sos GROUP BY pais
    UNION ALL
    SELECT 'search', pais, MAX(fecha::date)::text FROM eci.search GROUP BY pais
    ORDER BY 1, 2
  `)
  console.log('Current DB max dates:')
  r.rows.forEach(x => console.log(`  ${x.t} ${x.pais} -> ${x.max_d}`))
  await c.end()
}).catch(e => { console.error(e.message); process.exit(1) })
