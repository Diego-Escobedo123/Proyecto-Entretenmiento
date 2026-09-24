<script setup lang="ts">
/**
 * StatCard — tarjeta de estadística con número grande y un ícono decorativo
 * de fondo (usado en Profile: "146 Películas", "42 Libros", etc.)
 * `icon` es un nombre de Bootstrap Icons (sin el prefijo `bi-`).
 * `delta`, si es > 0, muestra un badge "+N este mes".
 * Uso:
 *   <StatCard icon="film" :value="146" label="Películas" :delta="8" />
 */
import BaseIcon from './BaseIcon.vue'

defineProps<{
  icon: string
  value: number | string
  label: string
  delta?: number
}>()
</script>

<template>
  <div class="stat-card">
    <BaseIcon :name="icon" class="stat-card__watermark" />
    <span v-if="delta" class="stat-card__badge">+{{ delta }} este mes</span>
    <strong class="stat-card__value">{{ value }}</strong>
    <p class="stat-card__label">{{ label }}</p>
  </div>
</template>

<style scoped>
.stat-card {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  min-height: 140px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: var(--space-xs);
}

.stat-card__watermark {
  position: absolute;
  right: -0.35rem;
  bottom: -0.75rem;
  font-size: 4.5rem;
  color: var(--color-text);
  opacity: 0.07;
  pointer-events: none;
}

.stat-card__badge {
  position: absolute;
  top: var(--space-md);
  left: var(--space-md);
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px var(--space-sm);
  border-radius: 999px;
}

.stat-card__value {
  color: var(--color-text);
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
}

.stat-card__label {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0;
}
</style>
