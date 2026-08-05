# Vercel Deployment Fixes

## Problemas Identificados

### 1. **Timeouts 504 en `/api/search`**
- **Causa**: Query de `segmentos` y `mercados` muy lentas con subqueries complejas
- **Síntoma**: "Vercel Runtime Timeout Error: Task timed out after 300 seconds"

### 2. **Conexiones saturadas 503 en `/api/sos`**
- **Causa**: "Too many database connections opened: FATAL: too many connections for role 'prisma_migration'"
- **Root Cause**: Pool de conexiones muy pequeño (5) + Refresh de Materialized Views bloqueando conexiones

## Soluciones Implementadas

### 1. ✅ Aumentar Connection Pool (src/lib/prisma.ts)
```
- Anterior: connection_limit=5, pool_timeout=30s
- Ahora:   connection_limit=15, pool_timeout=15s
```
**Por qué**: En Vercel con múltiples funciones concurrentes, 5 conexiones es insuficiente. 15 es más apropiado para serverless.

### 2. ✅ Optimizar Refresh de Materialized Views (src/lib/mv-refresh.ts)
```
- Anterior: Refresh cada 5 minutos, BLOQUEA request esperando resultado
- Ahora:   Refresh cada 30 minutos, NO BLOQUEA (runs in background)
```
**Por qué**: El REFRESH MATERIALIZED VIEW tarda mucho y bloqueaba las conexiones. Ahora:
- No espera el refresh (retorna inmediatamente)
- Usa REFRESH CONCURRENTLY cuando es posible (no bloquea reads)
- Intervalo más largo (30 min en lugar de 5 min)
- Mejor manejo de errores

### 3. ✅ Optimizar Queries Lentas (src/app/api/search/route.ts)
```
Queries de segmentos/mercados:
- Anterior: IN (SELECT DISTINCT ...) → Full table scan
- Ahora:   EXISTS con índices → Mucho más rápido
```
**Por qué**: Cambiar de IN a EXISTS permite que la BD use mejor los índices.

### 4. ✅ Agregar Error Handling y Timeouts
- **src/lib/prisma.ts**: Configuración de Vercel optimizada
- **vercel.json**: Nuevos parámetros:
  - `maxDuration: 60` segundos para API routes
  - Variables de entorno para connection pool
- **API endpoints**: Better error handling diferenciando timeouts de otros errores

## Cambios de Archivos

### Archivos Modificados:
1. `src/lib/prisma.ts` - Aumentar pool y mejorar logs
2. `src/lib/mv-refresh.ts` - No bloquear, aumentar intervalo
3. `src/app/api/search/route.ts` - Optimizar queries + error handling
4. `src/app/api/sos/route.ts` - Mejor error handling

### Archivos Creados:
1. `vercel.json` - Configuración de Vercel para timeouts y env vars

## Próximos Pasos (Recomendado)

### 1. Database Optimization (si es posible)
```sql
-- Agregar índices si no existen:
CREATE INDEX IF NOT EXISTS idx_marca_fab_segmento ON eci.marca_fabricante(segmento);
CREATE INDEX IF NOT EXISTS idx_marca_fab_mercado ON eci.marca_fabricante(mercado);
CREATE INDEX IF NOT EXISTS idx_mv_search_daily_fab_retail ON eci.mv_search_daily_fab(retail);
CREATE INDEX IF NOT EXISTS idx_mv_search_daily_fab_pais ON eci.mv_search_daily_fab(pais);
```

### 2. Monitor Vercel Logs
- Vercel Dashboard → Logs para ver si persisten los errores
- Esperar cambios de propagación (puede tomar 5-10 minutos)

### 3. Load Testing
- Probar endpoints después del deploy
- Monitor de response times

## Métricas Esperadas

| Métrica | Anterior | Después |
|---------|----------|---------|
| Connection Pool | 5 | 15 |
| Pool Timeout | 30s | 15s |
| MV Refresh Interval | 5 min | 30 min |
| MV Refresh Bloqueo | SÍ (full) | NO (background) |
| Query segmentos/mercados | Lenta (IN) | Rápida (EXISTS) |
| Error 503/504 rate | Alto | Bajo ↓ |

## Rollback si es Necesario

Si necesitas revertir:
```bash
git revert HEAD~4..HEAD
npm run build
vercel deploy
```

---
**Fecha de cambios**: 2026-08-05
**Afectados**: `/api/search`, `/api/sos`, Database Pool
