# Proyecto-Entretenmiento

## Docker

Levanta la app completa (PostgreSQL + API + frontend) sin instalar nada más
que Docker:

```bash
docker compose up --build
```

| Servicio | URL                     |
| -------- | ----------------------- |
| App      | http://localhost:8080   |
| API      | http://localhost:3000   |
| Postgres | `localhost:5433` (usuario/contraseña `postgres`, base `mosaic`) |

Las migraciones se aplican solas al arrancar la API. Para cargar los datos de
ejemplo (`demo@mosaic.app` / `demo123`):

```bash
docker compose exec backend bun prisma/seed.ts
```

- **API keys** (TMDB, RAWG, Google Books, Google): se leen de `backend/.env`
  si existe (ver `backend/.env.example`). Sin él la app funciona, pero la
  búsqueda en catálogos devuelve vacío.
- **Login con Google y PostHog**: crear un `.env` en la raíz con
  `VITE_GOOGLE_CLIENT_ID` y/o `VITE_POSTHOG_KEY` y reconstruir
  (`docker compose up --build`). Para Google, agregar `http://localhost:8080`
  a los orígenes autorizados del Client ID.
- Los datos quedan en el volumen `db-data`. `docker compose down -v` los borra.
