const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe(`
  SELECT c.relname AS view_name, a.attname AS col_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE n.nspname = 'eci'
    AND c.relname LIKE 'mv_sos_daily%'
    AND a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY c.relname, a.attnum
`).then(r => { console.log(JSON.stringify(r, null, 2)); p.$disconnect(); });
