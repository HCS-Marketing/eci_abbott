const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Kill all zombie queries except our current one
  console.log('=== Killing zombie queries ===')
  const zombies = await p.$queryRawUnsafe(`
    SELECT pid, state, 
      EXTRACT(EPOCH FROM NOW() - query_start)::int AS duration_s,
      LEFT(query, 80) AS q
    FROM pg_stat_activity
    WHERE datname = current_database() AND state = 'active' AND pid != pg_backend_pid()
      AND query LIKE '%eci.sos%'
    ORDER BY query_start
  `)
  console.table(zombies)

  for (const z of zombies) {
    console.log(`Terminating PID ${z.pid} (running ${z.duration_s}s)...`)
    await p.$queryRawUnsafe(`SELECT pg_terminate_backend(${z.pid})`)
  }
  console.log(`Killed ${zombies.length} zombie queries.`)

  // Wait a moment for locks to release
  console.log('\nWaiting 2s for locks to clear...')
  await new Promise(r => setTimeout(r, 2000))

  // Verify they're gone
  const remaining = await p.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS cnt FROM pg_stat_activity
    WHERE datname = current_database() AND state = 'active' AND pid != pg_backend_pid()
      AND query LIKE '%eci.sos%'
  `)
  console.log(`Remaining active eci.sos queries: ${remaining[0].cnt}`)

  await p.$disconnect()
  console.log('Done!')
}
main().catch(e => { console.error(e); process.exit(1) })
