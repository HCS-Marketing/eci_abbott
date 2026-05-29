const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()
async function main() {
  const mvs = await p.$queryRawUnsafe("SELECT matviewname FROM pg_matviews WHERE schemaname = 'eci'")
  console.log("All MVs in eci:", mvs.map(m => m.matviewname))
  await p.$disconnect()
}
main()
