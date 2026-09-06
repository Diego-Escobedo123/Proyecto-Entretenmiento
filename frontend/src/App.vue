<script setup lang="ts">
/**
 * App — raíz: monta el layout de la aplicación y la vista activa del router.
 */
import DefaultLayout from './layouts/DefaultLayout.vue'
</script>

<template>
  <DefaultLayout>
    <RouterView />
  </DefaultLayout>
</template>
