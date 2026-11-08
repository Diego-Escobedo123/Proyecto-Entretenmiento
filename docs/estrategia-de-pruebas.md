# Estrategia de pruebas de Mosaic

Este documento explica cómo se prueba Mosaic, qué cubre cada tipo de prueba, el criterio de cobertura mínima y cómo las pruebas bloquean un merge si algo se rompe (EXP-081).

## 1. Pirámide de pruebas

Seguimos la pirámide clásica: **muchas pruebas pequeñas y rápidas abajo, pocas pruebas grandes y lentas arriba.**

```
              ▲
             ╱ ╲        E2E (Playwright)              6 pruebas  · ~1 min
            ╱   ╲       La app completa en un navegador
           ╱─────╲
          ╱       ╲     Integración (bun test + PostgreSQL)  12 pruebas · ~10 s
         ╱         ╲    La API completa contra una base real
        ╱───────────╲
       ╱             ╲  Unitarias (bun test + base simulada)  79 pruebas · ~3 s
      ╱_______________╲ Funciones y endpoints, uno por uno
```

| Nivel | Qué prueba | Base de datos | Herramienta | Dónde vive |
|---|---|---|---|---|
| **Unitarias** | Cada endpoint y función por separado: validaciones, permisos, cálculos | Simulada (`tests/helpers/prisma.ts`) | Bun Test | `backend/tests/unit/` |
| **Integración** | Que las partes de la API funcionen juntas y guarden datos de verdad | PostgreSQL de pruebas real | Bun Test | `backend/tests/integration/` |
| **E2E** | Flujos completos como los haría una persona en el navegador | PostgreSQL de pruebas real | Playwright (Chromium sin ventana) | `frontend/e2e/` |

**Por qué así:** las unitarias corren en segundos y dicen exactamente qué se rompió, así que hay muchas. Las E2E son las más parecidas al uso real pero tardan más y fallan por más motivos, así que solo cubren los flujos críticos.

## 2. Qué cubre cada nivel

### Unitarias (EXP-072, EXP-073)
- **Auth:** registro, login (contraseña correcta, incorrecta, cuenta inexistente, demasiados intentos), sesiones cerradas, `/auth/me` sin datos sensibles, recuperar y cambiar contraseña, cambiar correo, borrar cuenta (el último admin no puede), contraseñas guardadas como hash, tokens JWT alterados o con otra clave, login con Google.
- **Registro de obras (`/media`):** crear, listar, editar, borrar; validaciones (título, fechas, calificación); que nadie pueda ver ni editar obras ajenas; que el diario se actualice al cambiar el estado.
- **Reseñas (`/reviews`):** promedio de estrellas, que no se muestren las reseñas propias ni las vacías, estadísticas de la obra.
- **Validaciones (`schemas.ts`):** datos válidos e inválidos de registro, login y obras.
- **Dónde comprar libros (`workDetails.ts`):** el enlace a Sophos (busca por título y autor, lleva `ref=mosaic`, solo para Guatemala), que vaya primero y que ya no aparezca Goodreads. Los catálogos se simulan, sin salir a internet.
- **Explorar con catálogos caídos (`explore.ts`):** que un catálogo que falla (por ejemplo RAWG) se recuerde unos minutos y la siguiente visita no lo vuelva a esperar, y cuándo se guarda o no un resultado vacío.

### Integración (EXP-074)
`/health`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`, `/media` (crear, listar, editar, borrar) y `GET /reviews`, contra una base PostgreSQL real.

### E2E (EXP-075, EXP-076)
Los 4 flujos críticos:
1. **Login:** crear cuenta, cerrar sesión y volver a entrar; contraseña incorrecta.
2. **Búsqueda:** buscar una obra en la barra superior y ver el resultado.
3. **Registrar obra:** agregarla desde "+ Agregar obra" y verla en "Mi colección".
4. **Publicar reseña:** una persona califica y escribe una reseña, y otra la ve en la ficha de la obra.

Los catálogos externos (TMDB, Google Books, RAWG) se **simulan** en el navegador: así las pruebas no dependen de internet ni de API keys y dan siempre el mismo resultado.

## 3. Criterio de cobertura mínima

- **Mínimo acordado: 70 % de líneas** en los módulos críticos de auth, registro de obras y reseñas:
  `src/lib/auth.ts`, `src/lib/schemas.ts`, `src/routes/auth.ts`, `src/routes/media.ts`, `src/routes/reviews.ts`.
- Lo revisa `backend/scripts/check-coverage.ts` después de `bun test --coverage`. **Si un módulo crítico baja del 70 %, el pipeline falla.**
- El resto del código se muestra en el reporte pero no bloquea: preferimos subir la cobertura de a poco donde más importa.
- Cada corrida de CI muestra la tabla de cobertura en el resumen de GitHub Actions (EXP-078).

Cobertura al cerrar el Sprint 6:

| Módulo crítico | Líneas |
|---|---|
| `src/lib/auth.ts` | 100 % |
| `src/lib/schemas.ts` | 99.5 % |
| `src/routes/auth.ts` | 78.8 % |
| `src/routes/media.ts` | 97.1 % |
| `src/routes/reviews.ts` | 99.1 % |

## 4. Quality gate en CI (EXP-077)

El workflow `.github/workflows/ci.yml` corre en cada push y en cada PR:

| Job | Qué revisa |
|---|---|
| **Backend** | Lint, tipos y que compile |
| **Frontend** | Lint, tipos y build |
| **Backend tests** | Unitarias + cobertura mínima + integración (con una PostgreSQL que levanta GitHub) |
| **E2E tests** | Playwright con los 4 flujos críticos |

En GitHub, **Settings → Rules → Rulesets**, las ramas `main` y `dev` exigen que pasen los 4 jobs. **Un PR con pruebas fallando no se puede mergear.**

## 5. Cómo correr las pruebas en local

**Unitarias** (no necesitan base de datos):
```bash
cd backend
bun run test            # solo las pruebas
bun run test:coverage   # pruebas + cobertura + revisión del 70 %
```

**Integración y E2E** (necesitan la base de pruebas, una sola vez):
```bash
docker compose up -d db
docker compose exec db createdb -U postgres mosaic_test
```
y en `backend/.env`:
```
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/mosaic_test"
```

Luego:
```bash
cd backend && bun run test:integration
cd frontend && bunx playwright install chromium   # solo la primera vez
cd frontend && bun run test:e2e
```

Por seguridad, las pruebas **solo** aceptan una base cuyo nombre incluya `test`: así nunca borran datos de desarrollo ni de producción.

## 6. Bugs que encontraron las pruebas

- **Pegar un título en "Agregar obra" no buscaba en el catálogo** (salía "Sin coincidencias"): la primera búsqueda después de abrir el formulario se perdía. Lo encontraron las pruebas E2E y se corrigió en `EntryFormModal.vue`.

## 7. QA cruzada (EXP-079, EXP-080)

Además de las pruebas automáticas, otro equipo prueba Mosaic a mano siguiendo un checklist (y nosotros el suyo). Cada hallazgo se registra como ticket en el backlog con su severidad; los críticos se corrigen antes de cerrar el sprint y, cuando se puede, se agrega una prueba automática para que no vuelva a pasar.
