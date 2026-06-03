# Architectural Fixes

## Fix A — Convert `ranking` to a PostgreSQL Generated Column

### Problem
`ranking` in `eci.sos` is a plain `numeric` column populated by ETL.
The data is inconsistent: some rows have `0.5`, `1.0`, or raw ordinals instead
of the intended scoring formula. If ETL ever runs without the scoring step,
data silently degrades and all ranking-based metrics become wrong.

### Solution
Drop and re-add `ranking` as a `GENERATED ALWAYS AS … STORED` column.
Postgres computes the value on every insert/update — no ETL step needed,
values are always correct.

### Scoring Formula
| Condition            | Score                                                              |
|----------------------|--------------------------------------------------------------------|
| `pagina = 1`         | `GREATEST(0.5, 21 - CEIL(orden / 4.0))` → positions 1–4 = 20, 5–8 = 19, … 77+ = 0.5 |
| `pagina = 2`         | `1.0`                                                              |
| `pagina ≥ 3` or NULL | `0.5`                                                              |

### Migration SQL
```sql
-- Run during off-hours — full table rewrite on ~9.9M rows (~5–15 min lock)
ALTER TABLE eci.sos DROP COLUMN ranking;
ALTER TABLE eci.sos ADD COLUMN ranking numeric
  GENERATED ALWAYS AS (
    CASE
      WHEN pagina = 1 THEN GREATEST(0.5, 21.0 - CEIL(orden / 4.0))
      WHEN pagina = 2 THEN 1.0
      ELSE 0.5
    END
  ) STORED;
```

### Post-migration
Refresh the ranking materialized views immediately after:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY eci.mv_ranking_daily_fab;
REFRESH MATERIALIZED VIEW CONCURRENTLY eci.mv_ranking_daily_marca;
REFRESH MATERIALIZED VIEW CONCURRENTLY eci.mv_ranking_daily_titulo;
```

### Impact on existing code
- **`prisma/etl-from-eci.ts`** — Remove any `UPDATE eci.sos SET ranking = …` step;
  inserting into a `GENERATED ALWAYS` column raises an error.
- **`src/app/api/sos/route.ts`** — No change needed; the `ranking` action reads
  `mv_sos_product_latest.best_ranking`, which refreshes from the base table.
- **`mv_sos_product_latest`** — Refresh after migration so `best_ranking` reflects
  the new generated values.
