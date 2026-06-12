const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'eci'
    AND table_name IN ('mv_sos_daily_fab','mv_sos_daily_marca','mv_sos_daily_titulo','mv_ranking_daily_fab','mv_ranking_daily_marca','mv_ranking_daily_titulo')
  ORDER BY table_name, ordinal_position
`).then(r => {
  console.log(JSON.stringify(r, null, 2));
  p.$disconnect();
});
