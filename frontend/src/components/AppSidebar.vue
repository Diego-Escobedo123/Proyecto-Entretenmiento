<script setup lang="ts">
/**
 * AppSidebar — navegación lateral. En escritorio es fija; en viewport angosto
 * se comporta como drawer controlado por `useUiStore().mobileNavOpen`.
 * La ruta activa se detecta con vue-router. El perfil sale del store.
 */
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import BaseButton from './BaseButton.vue'
import { NAV_ITEMS } from '../lib/navigation'
import { useProfileStore } from '../stores/profile'
import { useUiStore } from '../stores/ui'

const route = useRoute()
const ui = useUiStore()
const { profile } = storeToRefs(useProfileStore())

// Cierra el drawer al navegar.
watch(
  () => route.path,
  () => ui.toggleMobileNav(false),
)
</script>

<template>
  <div
    v-if="ui.mobileNavOpen"
    class="app-sidebar__scrim"
    @click="ui.toggleMobileNav(false)"
  />

  <aside class="app-sidebar" :class="{ 'app-sidebar--open': ui.mobileNavOpen }">
    <div class="app-sidebar__header">
      <h1 class="app-sidebar__brand">Mosaic</h1>
      <p class="app-sidebar__tagline">Tu identidad cultural</p>
    </div>

    <nav class="app-sidebar__nav">
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :to="item.to"
        class="app-sidebar__link"
        :class="{ 'app-sidebar__link--active': item.to === route.path }"
      >
        <span class="app-sidebar__icon" aria-hidden="true">{{ item.icon }}</span>
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="app-sidebar__footer">
      <BaseButton @click="ui.openCreateEntry()">+ Agregar obra</BaseButton>

      <button class="app-sidebar__user" type="button" @click="ui.openSettings()">
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
      </button>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: 260px;
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

.app-sidebar__brand {
  color: var(--color-accent);
  font-size: 1.375rem;
  font-weight: 800;
  margin: 0;
}

.app-sidebar__tagline {
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
  margin: 2px 0 var(--space-xl) 0;
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

.app-sidebar__link:hover {
  background: var(--color-surface);
  color: var(--color-text);
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

.app-sidebar__user {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: none;
  border: none;
  padding: var(--space-xs);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.app-sidebar__user:hover {
  background: var(--color-surface);
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
