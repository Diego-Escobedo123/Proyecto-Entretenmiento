<script setup lang="ts">
/**
 * AuthLayout — pantalla completa para login, registro y recuperar la
 * contraseña, sin sidebar ni topbar (nadie ha iniciado sesión todavía).
 *
 * Pantalla dividida: a la izquierda, un muro de portadas reales (películas,
 * series, libros, juegos y música) que se mueve despacio, con el higo y el
 * lema encima; a la derecha, el formulario. En celular el muro queda como
 * una franja arriba. Las portadas viven en `public/covers` (las mismas de la
 * presentación) para no sumar peso al código de la app.
 */
import BaseIcon from '../components/BaseIcon.vue'
import figLogo from '../assets/fig-logo.png'

const COVERS = [
  'movie-parasite', 'book-harrypotter', 'music-abbeyroad', 'series-strangerthings', 'game-hades', 'movie-lalaland',
  'book-gatsby', 'music-malquerer', 'series-fleabag', 'game-stardew', 'movie-amelie', 'book-1984',
  'music-sos', 'series-dark', 'game-eldenring', 'movie-roma', 'book-dune', 'music-rumours',
  'series-breakingbad', 'game-hollowknight', 'movie-chihiro', 'book-principito', 'music-ram', 'series-thebear',
  'movie-interstellar', 'book-rayuela', 'music-kindofblue', 'series-succession', 'movie-coco', 'book-hobbit',
]

const COLUMNS = 5
/** Cada columna repite su lista dos veces para que el desplazamiento no tenga cortes. */
const columns = Array.from({ length: COLUMNS }, (_, c) => {
  const own = COVERS.filter((_, i) => i % COLUMNS === c).map((name) => `/covers/${name}.jpg`)
  return [...own, ...own]
})

const TYPES = [
  { icon: 'film', label: 'Películas' },
  { icon: 'tv', label: 'Series' },
  { icon: 'book', label: 'Libros' },
  { icon: 'controller', label: 'Juegos' },
  { icon: 'music-note-beamed', label: 'Música' },
]
</script>

<template>
  <div class="auth-layout">
    <section class="auth-layout__showcase" aria-hidden="true">
      <div class="auth-layout__wall">
        <div v-for="(col, c) in columns" :key="c" class="auth-layout__col">
          <img v-for="(src, i) in col" :key="i" :src="src" alt="" class="auth-layout__cover" />
        </div>
      </div>
      <div class="auth-layout__veil" />

      <div class="auth-layout__brand">
        <img class="auth-layout__logo" :src="figLogo" alt="" />
        <h1 class="auth-layout__title">MOSAIC</h1>
        <p class="auth-layout__claim">Tu identidad cultural, <br />armada pieza por pieza.</p>
        <ul class="auth-layout__types">
          <li v-for="t in TYPES" :key="t.label"><BaseIcon :name="t.icon" class="auth-layout__type-icon" /> {{ t.label }}</li>
        </ul>
      </div>
    </section>

    <main class="auth-layout__side">
      <div class="auth-layout__card">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  background: var(--color-bg);
}

/* ---------- Muro de portadas ---------- */
.auth-layout__showcase {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--fig-purple);
}

.auth-layout__wall {
  position: absolute;
  inset: -15% -10%;
  display: flex;
  gap: 14px;
  transform: rotate(-8deg);
  opacity: 0.5;
}

.auth-layout__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: auth-wall-up 70s linear infinite;
}

.auth-layout__col:nth-child(even) {
  animation-name: auth-wall-down;
  animation-duration: 85s;
}

.auth-layout__cover {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}

/* Oscurece el muro hacia el centro para que se lea la marca. */
.auth-layout__veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 50%, rgba(36, 18, 34, 0.92) 0%, rgba(36, 18, 34, 0.7) 45%, rgba(36, 18, 34, 0.35) 100%),
    linear-gradient(90deg, transparent 45%, var(--color-bg) 99%);
}

.auth-layout__brand {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-xl);
}

.auth-layout__logo {
  width: 160px;
  height: 160px;
  object-fit: contain;
  filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.5));
}

.auth-layout__title {
  margin: var(--space-sm) 0 0 0;
  color: var(--fig-stem-green);
  font-size: 3.25rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1;
}

.auth-layout__claim {
  margin: var(--space-md) 0 0 0;
  color: var(--fig-cream);
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1.3;
}

.auth-layout__types {
  list-style: none;
  margin: var(--space-lg) 0 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm);
}

.auth-layout__types li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(243, 231, 216, 0.18);
  background: rgba(243, 231, 216, 0.06);
  color: var(--fig-cream);
  font-size: 0.8125rem;
  font-weight: 600;
  backdrop-filter: blur(6px);
}

.auth-layout__type-icon {
  color: var(--golden-fig);
}

/* ---------- Formulario ---------- */
.auth-layout__side {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl) var(--space-lg);
}

.auth-layout__card {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-sizing: border-box;
}

@keyframes auth-wall-up {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-50%);
  }
}

@keyframes auth-wall-down {
  from {
    transform: translateY(-50%);
  }
  to {
    transform: translateY(0);
  }
}

/* ---------- Celular y tablet: el muro pasa a ser una franja arriba ---------- */
@media (max-width: 900px) {
  .auth-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }

  .auth-layout__showcase {
    min-height: 0;
    height: 250px;
  }

  .auth-layout__wall {
    opacity: 0.4;
  }

  .auth-layout__veil {
    background:
      radial-gradient(ellipse at 50% 50%, rgba(36, 18, 34, 0.9) 0%, rgba(36, 18, 34, 0.6) 60%, rgba(36, 18, 34, 0.4) 100%),
      linear-gradient(180deg, transparent 65%, var(--color-bg) 100%);
  }

  .auth-layout__brand {
    padding: var(--space-md);
  }

  .auth-layout__logo {
    width: 88px;
    height: 88px;
  }

  .auth-layout__title {
    font-size: 2rem;
  }

  .auth-layout__claim {
    margin-top: var(--space-xs);
    font-size: 1rem;
  }

  .auth-layout__claim br,
  .auth-layout__types {
    display: none;
  }

  .auth-layout__side {
    align-items: flex-start;
    padding: 0 var(--space-md) var(--space-xl);
    margin-top: calc(var(--space-md) * -1);
    position: relative;
  }
}

@media (max-width: 480px) {
  .auth-layout__card {
    padding: var(--space-lg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-layout__col {
    animation: none;
  }
}
</style>
