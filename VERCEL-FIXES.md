# Vercel Deployment Fixes

## Problemas Identificados

### 1. **Timeouts 504 en `/api/search`**
- **Causa**: Query de `segmentos` y `mercados` muy lentas con subqueries complejas
- **Síntoma**: "Vercel Runtime Timeout Error: Task timed out after 300 seconds"

### 2. **Conexiones saturadas 503 en `/api/sos`**
- **Causa**: "Too many database connections opened: FATAL: too many connections for role 'prisma_migration'"
- **Root Cause**: Pool de conexiones demasiado alto para serverless + muchas funciones concurrentes + refresh de Materialized Views compitiendo por conexiones

## Soluciones Implementadas

### 1. ✅ Limitar Connection Pool (src/lib/prisma.ts)
```
- Anterior: connection_limit=15, pool_timeout=15s
- Ahora:   connection_limit=1, pool_timeout=15s
```
**Por qué**: En Vercel cada instancia serverless puede crear su propio pool. Un pool alto por instancia satura rápido el límite de Prisma Postgres cuando la UI dispara varias funciones a la vez.

### 2. ✅ Optimizar Refresh de Materialized Views (src/lib/mv-refresh.ts)
```
- Anterior: Refresh automático desde requests de producción
- Ahora:   Desactivado en producción por defecto; habilitable con AUTO_REFRESH_MVS=true
```
**Por qué**: El REFRESH MATERIALIZED VIEW tarda mucho y bloqueaba las conexiones. Ahora:
- No compite con requests de usuarios en Vercel
- Se puede ejecutar desde proceso controlado/cron configurando AUTO_REFRESH_MVS=true
- Mejor manejo de errores

### 2.b ✅ Refresh controlado de Materialized Views
Endpoint protegido:
```bash
curl -X POST "https://<dominio>/api/admin/refresh-mvs?module=all" \
  -H "Authorization: Bearer <REFRESH_MVS_TOKEN>"
```

Opciones:
- `module=sos` refresca solo vistas SOS
- `module=search` refresca solo vistas Search
- `module=all` refresca ambas
- `force=true` fuerza el refresh aunque las fechas parezcan alineadas

En producción debe existir `REFRESH_MVS_TOKEN` o `CRON_SECRET` en Vercel. Esto permite actualizar las MVs después de cargar datos sin ejecutar refresh pesado en cada request de usuario.

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
| Connection Pool | 15 | 1 |
| Pool Timeout | 30s | 15s |
| MV Refresh en producción | Automático por request | Desactivado por defecto |
| Requests paralelos desde UI | 4-5 por vista | Secuenciales por vista |
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
