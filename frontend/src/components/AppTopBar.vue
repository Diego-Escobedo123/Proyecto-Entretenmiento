<script setup lang="ts">
/**
 * AppTopBar — barra superior: toggle de nav (móvil), búsqueda global
 * (enlazada a `useUiStore().searchQuery`) y acceso a ajustes.
 */
import { storeToRefs } from 'pinia'
import { useUiStore } from '../stores/ui'
import { useProfileStore } from '../stores/profile'

withDefaults(defineProps<{ placeholder?: string }>(), {
  placeholder: 'Buscar en tu colección…',
})

const ui = useUiStore()
const { searchQuery } = storeToRefs(ui)
const { profile } = storeToRefs(useProfileStore())
</script>

<template>
  <header class="app-topbar">
    <button
      class="app-topbar__nav-toggle"
      type="button"
      aria-label="Abrir navegación"
      @click="ui.toggleMobileNav()"
    >
      ☰
    </button>

    <div class="app-topbar__search">
      <span class="app-topbar__search-icon" aria-hidden="true">🔍</span>
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="placeholder"
        class="app-topbar__search-input"
        aria-label="Buscar"
      />
    </div>

    <div class="app-topbar__actions">
      <button
        class="app-topbar__icon-btn"
        type="button"
        aria-label="Ajustes"
        @click="ui.openSettings()"
      >
        ⚙️
      </button>
      <button
        class="app-topbar__avatar"
        type="button"
        aria-label="Perfil"
        @click="ui.openSettings()"
      >
        <img v-if="profile.avatar" :src="profile.avatar" alt="" />
        <span v-else class="app-topbar__avatar-placeholder" aria-hidden="true">
          {{ profile.name.charAt(0).toUpperCase() }}
        </span>
      </button>
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

.app-topbar__search {
  flex: 1;
  max-width: 480px;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px var(--space-md);
}

.app-topbar__search-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  color: var(--color-text);
  font: inherit;
  font-size: 0.9375rem;
}

.app-topbar__search-input::placeholder {
  color: var(--color-text-subtle);
}

.app-topbar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-left: auto;
}

.app-topbar__icon-btn {
  background: none;
  border: none;
  font-size: 1.125rem;
  cursor: pointer;
  color: var(--color-text-muted);
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

@media (max-width: 860px) {
  .app-topbar__nav-toggle {
    display: block;
  }
}
</style>
