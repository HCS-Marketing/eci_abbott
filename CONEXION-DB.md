# Conexión a la base de datos — Referencia

## Cómo funciona hoy

La app usa **Prisma Client** para conectarse a una base **PostgreSQL** hosteada en
[Prisma Postgres](https://www.prisma.io/postgres) (`db.prisma.io`).

La conexión se configura **únicamente** a través de variables de entorno — no hay
ninguna credencial hardcodeada en el código.

### Archivo clave: `src/lib/prisma.ts`

```ts
// src/lib/prisma.ts agrega connection_limit=1 y pool_timeout=15
// si DATABASE_URL no los trae definidos.
new PrismaClient()
```

### Archivo clave: `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Variables de entorno necesarias

| Variable             | Dónde usarla                  | Descripción                        |
|----------------------|-------------------------------|------------------------------------|
| `DATABASE_URL`       | Obligatoria                   | URL de conexión Prisma Postgres    |
| `POSTGRES_URL`       | Alias (misma URL)             | Usada por algunas integraciones    |
| `PRISMA_DATABASE_URL`| Alias (misma URL)             | Usada por CLI de Prisma en CI      |

---

## Dónde conseguir las variables

### En producción (Vercel)
1. Ir a [vercel.com](https://vercel.com) → tu proyecto → **Settings** → **Environment Variables**
2. Copiar `DATABASE_URL`

### En el dashboard de Prisma Postgres
1. Ir a [console.prisma.io](https://console.prisma.io)
2. Seleccionar el proyecto → **Connection string**

---

## Desarrollo local

1. Crear el archivo `.env.local` en la raíz del proyecto (nunca se sube al repo):

```env
DATABASE_URL="postgres://<user>:<password>@db.prisma.io:5432/postgres?sslmode=require"
POSTGRES_URL="postgres://<user>:<password>@db.prisma.io:5432/postgres?sslmode=require"
PRISMA_DATABASE_URL="postgres://<user>:<password>@db.prisma.io:5432/postgres?sslmode=require"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

2. Correr el servidor local:

```bash
npm run dev
```

3. Abrir `http://localhost:3000/share-of-search` y verificar que carguen datos reales.

> `.env.local` ya está incluido en `.gitignore` — nunca se sube al repositorio.

---

## Estructura de datos en la DB

Los datos de Share of Shelf viven en el schema `eci`, tabla `eos.sos`:

- `seller` — nombre del retailer
- `plataforma` — canal (ej: MercadoLibre, Frávega)
- `subcategoria` — categoría del producto
- `fecha` — fecha del registro
- `ranking_pos` — posición en resultados de búsqueda
- `titulo_id`, `titulo` — identificador y nombre del producto

La API en `src/app/api/sos/route.ts` normaliza aliases de sellers via `SELLER_ALIASES`
(ej: "Tienda Newsan" → "Newsan").

---

## Cómo revertir / entregar el proyecto a otro dev

1. El código **no necesita cambios** — todo depende de variables de entorno.
2. El nuevo dev solo necesita:
   - Clonar el repo
   - Crear su propio `.env.local` con las credenciales del dashboard de Prisma/Vercel
   - Correr `npm install && npm run dev`
3. Para producción, asegurarse de que Vercel tenga `DATABASE_URL` configurada en
   **Settings → Environment Variables**.

---

## Si la DB migra o cambia de proveedor

Solo cambia el valor de `DATABASE_URL` en:
- `.env.local` (dev local)
- Vercel → Environment Variables (producción)

Si el proveedor cambia de Postgres a otro motor, también actualizar el `provider`
en `prisma/schema.prisma` y correr `npx prisma generate`.
