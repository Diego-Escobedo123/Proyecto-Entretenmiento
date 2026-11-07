<script setup lang="ts">
/**
 * BaseIcon — envuelve un icono de Bootstrap Icons.
 * Uso: <BaseIcon name="house" />  ->  <i class="bi bi-house" />
 * Catálogo de nombres: https://icons.getbootstrap.com/
 */
defineProps<{ name: string }>()
</script>

<template>
  <i class="bi" :class="`bi-${name}`" aria-hidden="true" />
</template>
