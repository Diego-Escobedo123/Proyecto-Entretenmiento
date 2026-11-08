# Mosaic

**Tu identidad cultural, armada pieza por pieza.**

Mosaic reúne en un solo perfil las películas, series, libros, videojuegos y música que consumes. Cada obra es una pieza, y tu historia cultural es el mosaico.

**App en vivo:** https://mosaic-app.me · **Presentación:** https://diego-escobedo123.github.io/Proyecto-Entretenmiento/

## ¿Qué problema resuelve?

Hoy cada gusto vive en una app distinta: una para lo que ves, otra para lo que lees, otra para lo que juegas y otra para lo que escuchas. Ninguna cuenta tu historia completa.

Mosaic es para quien consume cultura en varios formatos y quiere:

- tener todo en un solo lugar,
- recordar qué consumió y qué le pareció,
- descubrir qué sigue a partir de sus gustos y los de sus amigos.

## Qué se puede hacer

- **Buscar** en catálogos reales (TMDB, Google Books, Open Library, RAWG e iTunes) desde una sola barra.
- **Registrar** cada obra con su estado («Quiero leerlo», «Viendo», «Terminado»…), calificación de 0.5 a 5 estrellas y reseña.
- Llevar un **diario** de cada vez que ves o lees algo, y **metas anuales** como «leer 20 libros este año».
- Armar **listas** públicas o privadas, con ranking.
- **Seguir perfiles** y ver su actividad; las cuentas privadas aceptan solicitudes.
- Ver tu **ADN cultural**: tus géneros, tu constancia y tus favoritas.
- **Explorar** tendencias, próximos estrenos y joyas escondidas.
- Ver **dónde ver, leer o escuchar** cada obra. En Guatemala, los libros enlazan a la librería Sophos.
- Conocer el plan **Premium** (los pagos llegan en la siguiente fase).

## Equipo

- **Iris Piló**
- **Diego Escobedo**

Proyecto final de **Desarrollo de Productos de Software**, Universidad Francisco Marroquín, 2026.

## Entregables

| Qué | Dónde |
|---|---|
| App desplegada | https://mosaic-app.me |
| Presentación | https://diego-escobedo123.github.io/Proyecto-Entretenmiento/ (avanza con las flechas; el código está en [`docs/index.html`](docs/index.html)) |
| Cotización y modelo de cobro | [`cotizacion/costos.md`](cotizacion/costos.md) |
| Estrategia de pruebas (QA) | [`docs/estrategia-de-pruebas.md`](docs/estrategia-de-pruebas.md) |
| Backups de la base de datos | [`docs/backups-base-de-datos.md`](docs/backups-base-de-datos.md) |

## Stack

| Parte | Tecnología |
|---|---|
| Frontend | Vue 3 + TypeScript, Vite, Pinia, Vue Router |
| Backend | Bun + Hono, Zod para validar datos, JWT para sesiones |
| Base de datos | PostgreSQL con Prisma (migraciones versionadas) |
| Deploy | AWS: Amplify (frontend), ECS (API en contenedor) y RDS (PostgreSQL) |
| CI/CD | GitHub Actions: lint, tipos, pruebas unitarias, de integración y E2E en cada PR; deploy automático al hacer merge a `main` |

## Estructura del repositorio

```
frontend/      App en Vue (ver frontend/README.md)
backend/       API REST y esquema de la base (ver backend/README.md)
docs/          Presentación y documentación
cotizacion/    Cotización y modelo de cobro
.github/       Workflows de CI y deploy
```

## Correrlo en local

### Con Docker

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

### Sin Docker

Con [Bun](https://bun.sh) y una PostgreSQL local, sigue los pasos de
[`backend/README.md`](backend/README.md) y de [`frontend/README.md`](frontend/README.md).
