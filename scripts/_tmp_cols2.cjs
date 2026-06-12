const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe(
  "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'eci' AND table_name LIKE 'mv_sos%' ORDER BY table_name, ordinal_position"
).then(r => { console.log(JSON.stringify(r, null, 2)); p.$disconnect(); });
