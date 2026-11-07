<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="not-found">
    <p class="not-found__code">404</p>
    <h1 class="not-found__title">Esta página no existe</h1>
    <RouterLink to="/" class="not-found__link">Volver al inicio</RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-sm);
  min-height: 60vh;
}

.not-found__code {
  color: var(--color-accent);
  font-size: 3rem;
  font-weight: 800;
  margin: 0;
}

.not-found__title {
  color: var(--color-text);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.not-found__link {
  color: var(--color-accent);
  font-weight: 600;
}
</style>
