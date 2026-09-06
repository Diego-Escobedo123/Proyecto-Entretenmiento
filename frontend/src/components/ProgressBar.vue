<script setup lang="ts">
/**
 * ProgressBar — barra de progreso lineal (ej. "64% Completed").
 * Uso: <ProgressBar :percent="64" />
 */
import { computed } from 'vue'

const props = defineProps<{
  percent: number // 0-100
}>()

const clamped = computed(() => Math.min(100, Math.max(0, props.percent)))
</script>

<template>
  <div class="progress-bar" role="progressbar" :aria-valuenow="clamped" aria-valuemin="0" aria-valuemax="100">
    <div class="progress-bar__fill" :style="{ width: clamped + '%' }" />
  </div>
</template>

<style scoped>
.progress-bar {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--color-surface-2);
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 999px;
  transition: width 0.2s ease;
}
</style>
