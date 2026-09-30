<script setup lang="ts">
/**
 * ConstancyCard — "Constancia": heatmap del último año con los días en que
 * se empezó o terminó algo (del diario). Si no cabe, arranca mostrando los
 * días más recientes. Sirve para el perfil propio y los públicos ajenos.
 *
 * Uso:
 *   <ConstancyCard :days="['2026-09-01', …]" self />
 */
import { computed, nextTick, ref, watch } from 'vue'
import { buildHeatmap } from '../../lib/heatmap'

const props = defineProps<{ days: string[]; self?: boolean }>()

const heatmap = computed(() => buildHeatmap(props.days))

const gridEl = ref<HTMLElement | null>(null)
watch(
  [gridEl, heatmap],
  async () => {
    await nextTick()
    if (gridEl.value) gridEl.value.scrollLeft = gridEl.value.scrollWidth
  },
  { flush: 'post' },
)

const cellTitle = (count: number, label: string) =>
  `${count} ${count === 1 ? 'registro' : 'registros'} en ${props.self ? 'tu' : 'su'} diario · ${label}`
</script>

<template>
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">Constancia</h2>
      <span class="card__header-label">Últimos 365 días</span>
    </div>
    <div class="heatmap">
      <div ref="gridEl" class="heatmap__grid">
        <span
          v-for="day in heatmap"
          :key="day.date"
          class="heatmap__cell"
          :class="`heatmap__cell--${day.level}`"
          :title="cellTitle(day.count, day.label)"
        />
      </div>
      <div class="heatmap__legend">
        <span>Menos</span>
        <span class="heatmap__cell heatmap__cell--0" />
        <span class="heatmap__cell heatmap__cell--1" />
        <span class="heatmap__cell heatmap__cell--2" />
        <span class="heatmap__cell heatmap__cell--3" />
        <span class="heatmap__cell heatmap__cell--4" />
        <span>Más</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.card__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.card__header-label {
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
  font-weight: 600;
}

.heatmap__grid {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 11px);
  gap: 3px;
  overflow-x: auto;
  padding-bottom: var(--space-xs);
}

.heatmap__cell {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  background: var(--color-surface-2);
}

.heatmap__cell--1 {
  background: color-mix(in srgb, var(--color-accent) 25%, var(--color-surface-2));
}

.heatmap__cell--2 {
  background: color-mix(in srgb, var(--color-accent) 50%, var(--color-surface-2));
}

.heatmap__cell--3 {
  background: color-mix(in srgb, var(--color-accent) 75%, var(--color-surface-2));
}

.heatmap__cell--4 {
  background: var(--color-accent);
}

.heatmap__legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: var(--space-sm);
  color: var(--color-text-subtle);
  font-size: 0.75rem;
  justify-content: flex-end;
}

.heatmap__legend .heatmap__cell {
  width: 10px;
  height: 10px;
}
</style>
