<script setup lang="ts">
/**
 * SkeletonCard — silueta de una tarjeta de obra (portada 3:4 + título y
 * subtítulo) mientras carga, con el brillo de .mosaic-skeleton. Tiene la
 * misma forma que MediaCard: al llegar los datos, nada salta de lugar.
 * Uso: <SkeletonCard v-for="n in 8" :key="n" />
 */
</script>

<template>
  <div class="skeleton-card" aria-hidden="true">
    <div class="skeleton-card__cover mosaic-skeleton" />
    <div class="skeleton-card__body">
      <span class="skeleton-card__line skeleton-card__line--short mosaic-skeleton" />
      <span class="skeleton-card__line mosaic-skeleton" />
      <span class="skeleton-card__line skeleton-card__line--mid mosaic-skeleton" />
    </div>
  </div>
</template>

<style scoped>
.skeleton-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.skeleton-card__cover {
  aspect-ratio: 3 / 4;
}

.skeleton-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
}

.skeleton-card__line {
  height: 12px;
  border-radius: 999px;
}

.skeleton-card__line--short {
  width: 35%;
}

.skeleton-card__line--mid {
  width: 60%;
}
</style>
