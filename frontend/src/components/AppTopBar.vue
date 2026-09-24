<script setup lang="ts">
/**
 * AppTopBar — barra superior: toggle de nav (móvil), búsqueda global
 * (ver GlobalSearch) y el menú de perfil (Cuenta, Tema, Notificaciones)
 * que se despliega desde el avatar.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from './BaseIcon.vue'
import GlobalSearch from './GlobalSearch.vue'
import { useUiStore } from '../stores/ui'
import { useProfileStore } from '../stores/profile'
import { useTheme } from '../composables/useTheme'

const ui = useUiStore()
const { profile } = storeToRefs(useProfileStore())
const { theme, toggleTheme } = useTheme()

// Menú desplegable del avatar (Cuenta / Tema / Notificaciones).
const menuOpen = ref(false)
const menuWrapEl = ref<HTMLElement | null>(null)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function openAccount() {
  menuOpen.value = false
  ui.openSettings()
}

function onDocClick(event: MouseEvent) {
  if (menuOpen.value && menuWrapEl.value && !menuWrapEl.value.contains(event.target as Node)) {
    menuOpen.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <header class="app-topbar">
    <button
      class="app-topbar__nav-toggle"
      type="button"
      aria-label="Abrir navegación"
      @click="ui.toggleMobileNav()"
    >
      <BaseIcon name="list" />
    </button>

    <GlobalSearch />

    <div class="app-topbar__actions">
      <div ref="menuWrapEl" class="app-topbar__user-wrap">
        <button
          class="app-topbar__avatar"
          type="button"
          aria-label="Perfil"
          :aria-expanded="menuOpen"
          @click="toggleMenu"
        >
          <img v-if="profile.avatar" :src="profile.avatar" alt="" />
          <span v-else class="app-topbar__avatar-placeholder" aria-hidden="true">
            {{ profile.name.charAt(0).toUpperCase() }}
          </span>
        </button>

        <Transition name="user-menu">
          <div v-if="menuOpen" class="app-topbar__menu">
            <button type="button" class="app-topbar__menu-item" @click="openAccount">
              <BaseIcon name="person-circle" /> Cuenta
            </button>

            <div class="app-topbar__menu-item app-topbar__menu-item--row">
              <span class="app-topbar__menu-label"><BaseIcon name="circle-half" /> Tema</span>
              <button type="button" class="app-topbar__theme-toggle" @click.stop="toggleTheme">
                <BaseIcon :name="theme === 'dark' ? 'moon-stars-fill' : 'sun-fill'" />
                {{ theme === 'dark' ? 'Oscuro' : 'Claro' }}
              </button>
            </div>

            <div class="app-topbar__menu-item app-topbar__menu-item--row app-topbar__menu-item--soon">
              <span class="app-topbar__menu-label"><BaseIcon name="bell" /> Notificaciones</span>
              <span class="app-topbar__soon-badge">Próximamente</span>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-topbar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--color-bg);
}

.app-topbar__nav-toggle {
  display: none;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.25rem;
  cursor: pointer;
  padding: var(--space-xs);
}

.app-topbar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-left: auto;
}

.app-topbar__user-wrap {
  position: relative;
}

.app-topbar__avatar {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  width: 36px;
  height: 36px;
}

.app-topbar__avatar img,
.app-topbar__avatar-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 700;
}

.app-topbar__menu {
  position: absolute;
  top: calc(100% + var(--space-xs));
  right: 0;
  min-width: 220px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.app-topbar__menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-sm) var(--space-md);
  background: none;
  border: none;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-align: left;
  cursor: pointer;
}

button.app-topbar__menu-item:hover {
  background: var(--color-accent-hover-bg);
  color: var(--color-accent-hover-contrast);
}

.app-topbar__menu-item--row {
  justify-content: space-between;
  cursor: default;
}

.app-topbar__menu-item--soon {
  opacity: 0.65;
}

.app-topbar__menu-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.app-topbar__theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px var(--space-sm);
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
  color: var(--color-text);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.app-topbar__theme-toggle:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.app-topbar__soon-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-text-subtle);
  background: var(--color-surface-2);
  padding: 2px 8px;
  border-radius: 999px;
}

.user-menu-enter-active,
.user-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.user-menu-enter-from,
.user-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 860px) {
  .app-topbar__nav-toggle {
    display: block;
  }
}
</style>
