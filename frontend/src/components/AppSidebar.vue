<script setup lang="ts">
/**
 * AppSidebar — navegación lateral. En escritorio es fija; en viewport angosto
 * se comporta como drawer controlado por `useUiStore().mobileNavOpen`.
 * La ruta activa se detecta con vue-router. El perfil sale del store.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import BaseButton from './BaseButton.vue'
import BaseIcon from './BaseIcon.vue'
import figLogo from '../assets/fig-logo.png'
import { NAV_ITEMS } from '../lib/navigation'
import { useProfileStore } from '../stores/profile'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const auth = useAuthStore()
const { profile } = storeToRefs(useProfileStore())

// Menú desplegable del usuario (Editar perfil / Cerrar sesión).
const userMenuOpen = ref(false)
const userWrapEl = ref<HTMLElement | null>(null)

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function onLogout() {
  userMenuOpen.value = false
  auth.logout()
  router.push('/login')
}

function onDocClick(event: MouseEvent) {
  if (userMenuOpen.value && userWrapEl.value && !userWrapEl.value.contains(event.target as Node)) {
    userMenuOpen.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') userMenuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})

// Cierra el drawer y el menú de usuario al navegar.
watch(
  () => route.path,
  () => {
    ui.toggleMobileNav(false)
    userMenuOpen.value = false
  },
)
</script>

<template>
  <div
    v-if="ui.mobileNavOpen"
    class="app-sidebar__scrim"
    @click="ui.toggleMobileNav(false)"
  />

  <aside class="app-sidebar" :class="{ 'app-sidebar--open': ui.mobileNavOpen }">
    <!-- Logo + nombre: vuelve a Inicio (y cierra el drawer si ya estabas ahí). -->
    <RouterLink
      to="/"
      class="app-sidebar__header"
      aria-label="Mosaic — ir al inicio"
      @click="ui.toggleMobileNav(false)"
    >
      <img class="app-sidebar__logo" :src="figLogo" alt="" aria-hidden="true" />
      <div class="app-sidebar__brand-text">
        <h1 class="app-sidebar__brand">Mosaic</h1>
        <p class="app-sidebar__tagline">Every piece shapes your identity</p>
      </div>
    </RouterLink>

    <nav class="app-sidebar__nav">
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :to="item.to"
        class="app-sidebar__link"
        :class="{ 'app-sidebar__link--active': item.to === route.path }"
      >
        <span class="app-sidebar__icon"><BaseIcon :name="item.icon" /></span>
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="app-sidebar__footer">
      <BaseButton @click="ui.openCreateEntry()">+ Agregar obra</BaseButton>

      <div ref="userWrapEl" class="app-sidebar__user-wrap">
        <button
          class="app-sidebar__user"
          type="button"
          :aria-expanded="userMenuOpen"
          @click="toggleUserMenu"
        >
          <img
            v-if="profile.avatar"
            :src="profile.avatar"
            :alt="profile.name"
            class="app-sidebar__avatar"
          />
          <span v-else class="app-sidebar__avatar app-sidebar__avatar--placeholder" aria-hidden="true">
            {{ profile.name.charAt(0).toUpperCase() }}
          </span>
          <span class="app-sidebar__user-text">
            <span class="app-sidebar__user-name">{{ profile.name }}</span>
            <span v-if="profile.handle" class="app-sidebar__user-handle">@{{ profile.handle }}</span>
          </span>
          <BaseIcon
            name="chevron-down"
            class="app-sidebar__user-chevron"
            :class="{ 'app-sidebar__user-chevron--open': userMenuOpen }"
          />
        </button>

        <Transition name="user-menu">
          <div v-if="userMenuOpen" class="app-sidebar__user-menu">
            <button
              type="button"
              class="app-sidebar__user-menu-item app-sidebar__user-menu-item--danger"
              @click="onLogout"
            >
              <BaseIcon name="box-arrow-right" /> Cerrar sesión
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: 320px;
  flex-shrink: 0;
  height: 100vh;
  position: sticky;
  top: 0;
  background: var(--color-bg);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: var(--space-lg);
  box-sizing: border-box;
}

.app-sidebar__header {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
  margin-left: calc(-1 * var(--space-md));
  margin-bottom: var(--space-xl);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: opacity 0.15s ease;
}

.app-sidebar__header:hover {
  opacity: 0.85;
}

.app-sidebar__header:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.app-sidebar__logo {
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  object-fit: contain;
}

.app-sidebar__brand-text {
  display: flex;
  flex-direction: column;
  width: min-content;
  margin-left: -12px;
}

.app-sidebar__brand {
  color: var(--fig-stem-green);
  font-size: 2.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.1;
  white-space: nowrap;
  margin: 0;
}

.app-sidebar__tagline {
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
  text-align: center;
  margin: 2px 0 0 0;
}

.app-sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.app-sidebar__link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 12px var(--space-sm);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.9375rem;
  border-left: 3px solid transparent;
  transition: background 0.15s ease, color 0.15s ease;
}

.app-sidebar__link:hover,
.app-sidebar__link:active {
  background: var(--color-accent-hover-bg);
  color: var(--color-accent-hover-contrast);
}

.app-sidebar__link--active {
  background: var(--color-surface);
  color: var(--color-accent);
  border-left-color: var(--color-accent);
}

.app-sidebar__icon {
  font-size: 1.125rem;
}

.app-sidebar__footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.app-sidebar__user-wrap {
  position: relative;
}

.app-sidebar__user {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  background: none;
  border: none;
  padding: var(--space-xs);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  font: inherit;
  box-sizing: border-box;
}

.app-sidebar__user:hover {
  background: var(--color-accent-hover-bg);
}

.app-sidebar__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.app-sidebar__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 700;
}

.app-sidebar__user-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.app-sidebar__user-chevron {
  flex-shrink: 0;
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
  transition: transform 0.15s ease;
}

.app-sidebar__user-chevron--open {
  transform: rotate(180deg);
}

.app-sidebar__user-name {
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 600;
}

.app-sidebar__user-handle {
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
}

.app-sidebar__user-menu {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + var(--space-xs));
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.app-sidebar__user-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: none;
  border: none;
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-align: left;
}

.app-sidebar__user-menu-item:hover {
  background: var(--color-accent-hover-bg);
  color: var(--color-accent-hover-contrast);
}

.app-sidebar__user-menu-item--danger:hover {
  background: rgba(192, 69, 60, 0.14);
  color: var(--color-danger);
}

.user-menu-enter-active,
.user-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.user-menu-enter-from,
.user-menu-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.app-sidebar__scrim {
  display: none;
}

@media (max-width: 860px) {
  .app-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }

  .app-sidebar--open {
    transform: translateX(0);
  }

  .app-sidebar__scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgba(0, 0, 0, 0.5);
  }
}
</style>