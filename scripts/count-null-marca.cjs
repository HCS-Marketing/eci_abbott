const {Client} = require('pg')
const fs = require('fs')
const path = require('path')

const DB = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').match(/DATABASE_URL="([^"]+)"/)?.[1]
const c = new Client({connectionString: DB})

c.connect().then(async () => {
  const r = await c.query(`
    SELECT 'sos' AS t, COUNT(*) AS cnt FROM eci.sos WHERE fecha >= '2026-05-04' AND (marca IS NULL OR marca = '')
    UNION ALL
    SELECT 'search', COUNT(*) FROM eci.search WHERE fecha >= '2026-05-04' AND (marca IS NULL OR marca = '')
  `)
  r.rows.forEach(x => console.log(`  ${x.t}: ${x.cnt} null-marca rows (May 4+)`))
  await c.end()
}).catch(e => { console.error(e.message); process.exit(1) })
