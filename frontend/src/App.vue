<script setup lang="ts">
/**
 * App — raíz: elige el layout según la ruta (AuthLayout para login/register,
 * DefaultLayout para el resto) y envuelve la vista activa en una transición
 * de página.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'
import AuthLayout from './layouts/AuthLayout.vue'

const route = useRoute()
const layout = computed(() => (route.meta.public ? AuthLayout : DefaultLayout))
</script>

<template>
  <component :is="layout">
    <RouterView v-slot="{ Component, route: activeRoute }">
      <transition name="page" mode="out-in">
        <component :is="Component" :key="activeRoute.path" />
      </transition>
    </RouterView>
  </component>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>