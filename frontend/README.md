# Mosaic — Frontend

App para registrar y analizar tu consumo cultural (películas, libros, juegos, álbumes)
y construir un "perfil cultural" a partir de esos datos.

Vue 3 (`<script setup>`) + TypeScript + Vite + vue-router + Pinia.

## Scripts

Este proyecto usa [bun](https://bun.sh). `bun.lock` es el único lockfile versionado.

```bash
bun install
bun run dev      # servidor de desarrollo
bun run build    # type-check (vue-tsc) + build de producción
bun run preview  # sirve el build
```

Necesita el backend corriendo (ver `../backend`). La URL se configura con
`VITE_API_URL` (default en `.env`: `http://localhost:3000`).

## Íconos

- **Bootstrap Icons** es la fuente principal: `<BaseIcon name="house" />`
  ([catálogo](https://icons.getbootstrap.com/)).
- **Font Awesome Free** sólo para los que Bootstrap Icons no tiene (hoy: `dna`):
  `<FaIcon :icon="faDna" />`, importando cada ícono de
  `@fortawesome/free-solid-svg-icons`. Al build entra sólo lo que se importa.

Nada de emojis en la interfaz: siempre un ícono de estas dos fuentes.

## Arquitectura

Flujo de datos en una sola dirección: **screen → store → service → backend**.
Ningún componente toca `fetch` ni `localStorage` directamente.

```
src/
├─ types/media.ts          Modelo de dominio (MediaEntry, UserProfile, …)
├─ lib/
│  ├─ api.ts               Cliente HTTP: base URL, token JWT, manejo de errores
│  ├─ catalog.ts           Metadatos de tipos y estados (labels, íconos, colores)
│  └─ navigation.ts        Ítems del menú lateral
├─ services/               Capa de acceso a datos (intercambiable)
│  ├─ storage.ts           Wrapper tipado sobre localStorage + helpers
│  ├─ mediaService.ts      MediaService: CRUD de obras (HTTP; Local* como fallback)
│  └─ profileService.ts    ProfileService: perfil del usuario
├─ stores/                 Estado global (Pinia)
│  ├─ media.ts             Colección + getters derivados + acciones CRUD
│  ├─ profile.ts           Perfil del usuario
│  └─ ui.ts                Búsqueda global, modal activo, drawer móvil
├─ composables/
│  └─ useCulturalProfile.ts  Deriva TODO el contenido del perfil desde las obras
├─ layouts/DefaultLayout.vue  Chrome común + host de modales globales
├─ components/             Componentes reutilizables (Base*, App*, modales…)
└─ Screens/                Vistas de ruta (home, collection, profile, …)
```

### Persistencia

Los datos viven en el backend (PostgreSQL vía Prisma). Cada usuario ve sólo sus
obras. El token JWT se guarda en `localStorage` (`mosaic:token`) y `lib/api.ts`
lo manda en cada request; `stores/auth.ts` lo revalida contra `/auth/me` al
arrancar. `LocalMediaService` / `LocalProfileService` quedan en el código como
fallback offline: cambiando la línea del `export` al final de cada service se
vuelve a modo `localStorage`.

## Pendiente (requiere más backend)

- **Explorar** (recomendaciones) y **Listas** propias: siguen hardcodeadas, no
  hay endpoints todavía.
- Inicio con Google (OAuth).
- Comunidad / social.

## Créditos

- Íconos de [Bootstrap Icons](https://icons.getbootstrap.com/), licencia MIT.
- Íconos de [Font Awesome Free](https://fontawesome.com/), licencia
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
