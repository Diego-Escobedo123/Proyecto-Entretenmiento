<script setup lang="ts">
/**
 * StatCard — tarjeta de estadística con ícono (usado en Profile:
 * "146 historias en el cine", "42 libros...", etc.)
 * `icon` es un nombre de Bootstrap Icons (sin el prefijo `bi-`).
 * Uso:
 *   <StatCard icon="film" :value="146" label="historias en el cine" prefix="Has vivido" />
 */
import BaseIcon from './BaseIcon.vue'

defineProps<{
  icon: string
  value: number | string
  label: string
  prefix?: string
}>()
</script>

<template>
  <div class="stat-card">
    <div class="stat-card__icon"><BaseIcon :name="icon" /></div>
    <p class="stat-card__text">
      <span v-if="prefix">{{ prefix }} </span>
      <strong class="stat-card__value">{{ value }}</strong>
      {{ ' ' + label }}
    </p>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-height: 140px;
  justify-content: space-between;
}

.stat-card__icon {
  font-size: 1.5rem;
}

.stat-card__text {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
  margin: 0;
  line-height: 1.4;
}

.stat-card__value {
  color: var(--color-accent);
  font-size: 1.25rem;
}
</style>
