<script setup lang="ts">
/**
 * DefaultLayout — chrome común de la app (sidebar + topbar + contenedor de
 * contenido) y host de los modales globales. Las screens sólo renderizan su
 * contenido dentro del <slot>.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '../components/AppSidebar.vue'
import FloatingSeeds from '../components/FloatingSeeds.vue'
import AppTopBar from '../components/AppTopBar.vue'
import WorkDetailModal from '../components/WorkDetailModal.vue'
import EntryFormModal from '../components/EntryFormModal.vue'
import SettingsModal from '../components/SettingsModal.vue'
import AppBottomNav from '../components/AppBottomNav.vue'
import ToastHost from '../components/ToastHost.vue'
import { useMediaStore } from '../stores/media'
import { useProfileStore } from '../stores/profile'
import { useFollowRequestsStore } from '../stores/followRequests'
import { useNotificationsStore } from '../stores/notifications'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const media = useMediaStore()
const profile = useProfileStore()
const followRequests = useFollowRequestsStore()
const notifications = useNotificationsStore()
const route = useRoute()

/** Las semillas flotantes de fondo sólo se ven en Inicio. */
const showSeeds = computed(() => route.name === 'home')

onMounted(() => {
  void media.ensureLoaded()
  void profile.ensureLoaded()
  void followRequests.load()
  notifications.startPolling()
})

// Al salir de la app (cerrar sesión → login) deja de pedir notificaciones.
onBeforeUnmount(() => notifications.reset())
</script>

<template>
  <div class="app-shell">
    <!-- Antes que el sidebar: así el sidebar (opaco) queda encima y las semillas
         sólo se ven detrás del contenido, que sube con z-index 1. -->
    <Transition name="seeds-fade">
      <FloatingSeeds v-if="showSeeds" />
    </Transition>

    <AppSidebar />

    <div class="app-shell__main">
      <AppTopBar />
      <main class="app-shell__content">
        <slot />
      </main>
    </div>

    <!-- La ficha va antes que el formulario: al pasar de una a otro, la ficha se
         desmonta primero y no desbloquea el scroll que el formulario acaba de bloquear. -->
    <WorkDetailModal v-if="ui.detailWork" />
    <EntryFormModal v-if="ui.isEntryFormOpen" />
    <SettingsModal v-if="ui.isSettingsOpen" />

    <!-- Sólo en el celular -->
    <AppBottomNav />
    <ToastHost />
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
  /* Por encima de las semillas flotantes (z-index 0). */
  position: relative;
  z-index: 1;
}

.seeds-fade-enter-active,
.seeds-fade-leave-active {
  transition: opacity 0.3s ease;
}

.seeds-fade-enter-from,
.seeds-fade-leave-to {
  opacity: 0;
}

.app-shell__content {
  flex: 1;
  padding: var(--space-lg) var(--space-xl) var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

/* Con la barra inferior (≤ 860px), el final del contenido no queda tapado por ella. */
@media (max-width: 860px) {
  .app-shell__content {
    padding-bottom: calc(var(--bottom-nav-height) + var(--space-xl) + env(safe-area-inset-bottom, 0px));
  }
}

@media (max-width: 640px) {
  .app-shell__content {
    padding-left: var(--space-md);
    padding-right: var(--space-md);
  }
}
</style>