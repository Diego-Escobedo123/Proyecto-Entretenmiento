<script setup lang="ts">
/**
 * DefaultLayout — chrome común de la app (sidebar + topbar + contenedor de
 * contenido) y host de los modales globales. Las screens sólo renderizan su
 * contenido dentro del <slot>.
 */
import { onMounted } from 'vue'
import AppSidebar from '../components/AppSidebar.vue'
import AppTopBar from '../components/AppTopBar.vue'
import EntryFormModal from '../components/EntryFormModal.vue'
import SettingsModal from '../components/SettingsModal.vue'
import { useMediaStore } from '../stores/media'
import { useProfileStore } from '../stores/profile'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const media = useMediaStore()
const profile = useProfileStore()

onMounted(() => {
  void media.ensureLoaded()
  void profile.ensureLoaded()
})
</script>

<template>
  <div class="app-shell">
    <AppSidebar />

    <div class="app-shell__main">
      <AppTopBar />
      <main class="app-shell__content">
        <slot />
      </main>
    </div>

    <EntryFormModal v-if="ui.isEntryFormOpen" />
    <SettingsModal v-if="ui.isSettingsOpen" />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}

.app-shell__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-shell__content {
  flex: 1;
  padding: var(--space-lg) var(--space-xl) var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

@media (max-width: 640px) {
  .app-shell__content {
    padding: var(--space-lg) var(--space-md) var(--space-xl);
  }
}
</style>
