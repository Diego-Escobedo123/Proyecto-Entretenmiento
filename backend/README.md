# Mosaic — Backend

API REST para Mosaic. Provee autenticación (JWT) y el CRUD de obras y perfil que
hoy el frontend resuelve contra `localStorage`.

**Stack:** [Bun](https://bun.sh) + [Hono](https://hono.dev) + [Prisma](https://www.prisma.io/)
+ PostgreSQL.

## Puesta en marcha

Necesitás una PostgreSQL corriendo. Local con Docker:

```bash
docker run --name mosaic-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mosaic -p 5432:5432 -d postgres:17
```

o una gratis en la nube (Neon, Supabase, Railway).

```bash
cd backend
cp .env.example .env      # Windows PowerShell: copy .env.example .env
# editar DATABASE_URL en .env si tu Postgres no es la de arriba
bun install
bun run db:migrate        # aplica las migraciones al esquema
bun run db:seed           # opcional: usuario demo + obras de ejemplo
bun run dev               # http://localhost:3000  (recarga en caliente)
```

`.env` no se versiona.

## Scripts

| Script            | Qué hace                                             |
| ----------------- | --------------------------------------------------- |
| `bun run dev`     | Servidor con recarga en caliente                    |
| `bun run start`   | Servidor sin watcher                                |
| `bun run db:migrate` | Aplica/crea migraciones según `schema.prisma`    |
| `bun run db:generate` | Regenera el cliente de Prisma                    |
| `bun run db:reset`   | Borra y recrea la base (¡pierde datos!)          |
| `bun run db:studio`  | Explorador visual de la base (Prisma Studio)     |
| `bun run db:seed`    | Carga datos de ejemplo                           |

## Endpoints

Base URL: `http://localhost:3000`

### Auth

| Método | Ruta             | Body                          | Respuesta                       |
| ------ | ---------------- | ----------------------------- | ------------------------------- |
| POST   | `/auth/register` | `{ name, email, password }`   | `201 { token, user }`           |
| POST   | `/auth/login`    | `{ email, password }`         | `200 { token, user }`           |
| GET    | `/auth/me`       | —  (header `Authorization`)   | `200 { user }`                  |

`user` = `{ id, name, email }`. `password` mínimo 6 caracteres.

### Obras — `Authorization: Bearer <token>` obligatorio

| Método | Ruta          | Body                        | Respuesta              |
| ------ | ------------- | --------------------------- | ---------------------- |
| GET    | `/media`      | —                           | `200 MediaEntry[]`     |
| GET    | `/media/:id`  | —                           | `200 MediaEntry`       |
| POST   | `/media`      | `MediaEntryInput`           | `201 MediaEntry`       |
| PATCH  | `/media/:id`  | `Partial<MediaEntryInput>`  | `200 MediaEntry`       |
| DELETE | `/media/:id`  | —                           | `204`                  |

### Perfil — token obligatorio

| Método | Ruta       | Body                     | Respuesta            |
| ------ | ---------- | ------------------------ | -------------------- |
| GET    | `/profile` | —                        | `200 UserProfile`    |
| PATCH  | `/profile` | `Partial<UserProfile>`   | `200 UserProfile`    |

Los shapes `MediaEntry`, `MediaEntryInput` y `UserProfile` son los de
`frontend/src/types/media.ts`. Cada obra pertenece a un usuario; sólo ve y
modifica las propias.

## Conectar el frontend

En el frontend, crear `HttpMediaService` / `HttpProfileService` con la misma
interfaz que los `Local*Service` actuales, guardar el token del login en el store
de auth y mandarlo en el header `Authorization`. Definir la base URL con
`VITE_API_URL` (ej. `http://localhost:3000`).

## Notas

- Contraseñas: hash con `Bun.password` (bcrypt). JWT con `hono/jwt`, expira a los 7 días.
- `genres` es un array nativo de Postgres (`text[]`). `src/lib/serialize.ts` sólo
  normaliza fechas a ISO y filtra los campos escribibles.
- CORS permite `http://localhost:5173` (Vite). Ajustar con `CORS_ORIGIN`.
- Postgres serverless con pooler (Neon/Supabase): agregá `DIRECT_URL` al `.env` y
  `directUrl = env("DIRECT_URL")` al `datasource` para que corran las migraciones.
