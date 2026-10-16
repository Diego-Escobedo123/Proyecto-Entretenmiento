<script setup lang="ts">
/**
 * App — raíz: elige el layout según la ruta (AuthLayout para login/register,
 * DefaultLayout para el resto) y envuelve la vista activa en una transición
 * de página simple (crossfade, sin mode="out-in" para evitar que la
 * transición se quede esperando indefinidamente).
 * La `key` incluye `ui.screenKey`: al tocar en la navegación la sección en
 * la que ya estás, la pantalla se vuelve a montar desde cero (ver resetScreen).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'
import AuthLayout from './layouts/AuthLayout.vue'
import { useUiStore } from './stores/ui'

const route = useRoute()
const ui = useUiStore()
const layout = computed(() => (route.meta.public ? AuthLayout : DefaultLayout))
</script>

<template>
  <component :is="layout">
    <RouterView v-slot="{ Component, route: activeRoute }">
      <transition name="page">
        <component :is="Component" :key="`${activeRoute.path}#${ui.screenKey}`" />
      </transition>
    </RouterView>
  </component>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}

.page-leave-active {
  position: absolute;
  width: 100%;
}
</style>