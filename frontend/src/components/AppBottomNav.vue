<script setup lang="ts">
/**
 * AppBottomNav — barra de navegación inferior, sólo en pantallas angostas
 * (≤ 860px, donde el sidebar pasa a ser un cajón). Las 4 secciones de uso
 * diario y, al centro, "Agregar obra". El resto (Listas, Personas, Perfil…)
 * sigue en el cajón, que abre el botón de la barra superior.
 * La sección activa lleva una pastilla que se desliza (useSlidingIndicator).
 */
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import BaseIcon from './BaseIcon.vue'
import { useUiStore } from '../stores/ui'
import { useSlidingIndicator } from '../composables/useSlidingIndicator'

const route = useRoute()
const ui = useUiStore()

const LEFT = [
  { label: 'Inicio', icon: 'house', iconActive: 'house-fill', to: '/' },
  { label: 'Explorar', icon: 'compass', iconActive: 'compass-fill', to: '/explore' },
]
const RIGHT = [
  { label: 'Colección', icon: 'collection', iconActive: 'collection-fill', to: '/collection' },
  { label: 'Diario', icon: 'journal-bookmark', iconActive: 'journal-bookmark-fill', to: '/diary' },
]

/** Igual que en el sidebar: activo en su ruta y en las que cuelgan de ella. */
function isActive(to: string): boolean {
  return route.path === to || (to !== '/' && route.path.startsWith(`${to}/`))
}

const barEl = ref<HTMLElement | null>(null)
const { style: pillStyle, ready: pillReady } = useSlidingIndicator(barEl, '.bottom-nav__link.is-active', () => route.path)
</script>

<template>
  <nav ref="barEl" class="bottom-nav" aria-label="Navegación principal">
    <span class="bottom-nav__pill" :class="{ 'is-ready': pillReady }" :style="pillStyle" aria-hidden="true" />

    <RouterLink
      v-for="item in LEFT"
      :key="item.to"
      :to="item.to"
      class="bottom-nav__link"
      :class="{ 'is-active': isActive(item.to) }"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <BaseIcon :name="isActive(item.to) ? item.iconActive : item.icon" />
      <span>{{ item.label }}</span>
    </RouterLink>

    <button type="button" class="bottom-nav__add" aria-label="Agregar obra" @click="ui.openCreateEntry()">
      <BaseIcon name="plus-lg" />
    </button>

    <RouterLink
      v-for="item in RIGHT"
      :key="item.to"
      :to="item.to"
      class="bottom-nav__link"
      :class="{ 'is-active': isActive(item.to) }"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <BaseIcon :name="isActive(item.to) ? item.iconActive : item.icon" />
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  display: none;
}

@media (max-width: 860px) {
  .bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 45; /* sobre el contenido; debajo del cajón (55/60), los modales y los avisos */
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    align-items: center;
    height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px));
    padding: 0 var(--space-sm) env(safe-area-inset-bottom, 0px);
    box-sizing: border-box;
    border-top: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-bg) 88%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
}

/* Fondo de la sección activa: se desliza al cambiar de pantalla. */
.bottom-nav__pill {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: var(--radius-md);
  background: var(--color-accent-bg);
  pointer-events: none;
}

.bottom-nav__pill.is-ready {
  transition: transform var(--dur-base) var(--ease-out), width var(--dur-base) var(--ease-out), opacity var(--dur-fast) ease;
}

.bottom-nav__link {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin: 6px 2px;
  padding: 6px 0;
  color: var(--color-text-subtle);
  font-size: 0.6875rem;
  font-weight: 600;
  transition: color var(--dur-base) ease;
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav__link .bi {
  font-size: 1.25rem;
}

.bottom-nav__link.is-active {
  color: var(--color-accent);
}

/* El ícono nuevo hace un pequeño pop al llegar a la sección. */
.bottom-nav__link.is-active .bi {
  display: inline-block;
  animation: mosaic-pop var(--dur-base) var(--ease-spring);
}

.bottom-nav__link:focus-visible,
.bottom-nav__add:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-md);
}

/* "Agregar obra": botón dorado al centro, un poco más alto que la barra. */
.bottom-nav__add {
  justify-self: center;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-top: -18px;
  padding: 0;
  border: 4px solid var(--color-bg);
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-size: 1.25rem;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-spring);
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav__add:active {
  transform: scale(0.92);
}
</style>
