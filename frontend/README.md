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

## Arquitectura

Flujo de datos en una sola dirección: **screen → store → service → persistencia**.
Ningún componente toca `localStorage` ni `fetch` directamente.

```
src/
├─ types/media.ts          Modelo de dominio (MediaEntry, UserProfile, …)
├─ lib/
│  ├─ catalog.ts           Metadatos de tipos y estados (labels, íconos, colores)
│  └─ navigation.ts        Ítems del menú lateral
├─ services/               Capa de acceso a datos (intercambiable)
│  ├─ storage.ts           Wrapper tipado sobre localStorage + helpers
│  ├─ mediaService.ts      MediaService: CRUD de obras (hoy local, mañana HTTP)
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

### Cambiar a un backend real

Cuando exista la API, crear `HttpMediaService implements MediaService` (mismo
contrato que `LocalMediaService`) y cambiar el `export` al final de
`services/mediaService.ts`. Stores, composables y componentes no cambian.

## Persistencia actual

`localStorage`, claves `mosaic.entries.v1` y `mosaic.profile.v1`. La app arranca
vacía; los datos se crean desde el botón **+ Agregar obra**.

## Pendiente (requiere backend)

- Autenticación y perfil multiusuario.
- Secciones **Explorar** (recomendaciones) y **Listas** (colecciones propias).
- Comunidad / social.
