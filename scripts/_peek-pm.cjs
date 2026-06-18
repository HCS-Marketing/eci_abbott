const { Client } = require('pg')
const fs = require('fs')
const env = fs.readFileSync('.env.local', 'utf8')
const DB = env.match(/DATABASE_URL="?([^"\r\n]+)"?/)[1]
;(async () => {
  const c = new Client({ connectionString: DB })
  await c.connect()
  const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='eci' AND table_name='products_master' ORDER BY ordinal_position`)
  console.log('Existing columns:', r.rows.map(x => x.column_name).join(', '))
  await c.end()
})().catch(e => console.error(e.message))
