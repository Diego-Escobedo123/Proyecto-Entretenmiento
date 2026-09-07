<script setup lang="ts">
/**
 * RefineDiscoveryPanel — filtros de exploración (era, género, rating mínimo).
 * Hardcodeado por ahora: `modelValue` vive en Explore.vue como estado local;
 * cuando exista el backend, "Aplicar filtros" dispara la query real.
 */
import { ref } from 'vue'
import BaseTag from '../BaseTag.vue'
import BaseButton from '../BaseButton.vue'

const props = defineProps<{
  genres: string[]
  activeGenres: string[]
  minRating: number
}>()

const emit = defineEmits<{
  'toggle-genre': [genre: string]
  'update:minRating': [value: number]
  apply: []
}>()

const localRating = ref(props.minRating)

function onRatingInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  localRating.value = value
  emit('update:minRating', value)
}
</script>

<template>
  <aside class="refine-panel">
    <h2 class="refine-panel__title">Refinar descubrimiento</h2>

    <div class="refine-panel__field">
      <label class="refine-panel__label" for="era">Era / Año</label>
      <select id="era" class="refine-panel__select">
        <option>Cualquier era</option>
        <option>2020s</option>
        <option>2010s</option>
        <option>2000s</option>
        <option>Siglo XX</option>
      </select>
    </div>

    <div class="refine-panel__field">
      <p class="refine-panel__label">Género</p>
      <div class="refine-panel__tags">
        <BaseTag
          v-for="genre in genres"
          :key="genre"
          :active="activeGenres.includes(genre)"
          @click="$emit('toggle-genre', genre)"
        >
          {{ genre }}
        </BaseTag>
      </div>
    </div>

    <div class="refine-panel__field">
      <div class="refine-panel__rating-header">
        <label class="refine-panel__label" for="rating">Calificación mínima</label>
        <span class="refine-panel__rating-value">{{ localRating.toFixed(1) }}+</span>
      </div>
      <input
        id="rating"
        type="range"
        min="0"
        max="5"
        step="0.5"
        :value="localRating"
        class="refine-panel__slider"
        @input="onRatingInput"
      />
    </div>

    <BaseButton variant="outline" @click="$emit('apply')">Aplicar filtros</BaseButton>
  </aside>
</template>

<style scoped>
.refine-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.refine-panel__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.refine-panel__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.refine-panel__label {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.refine-panel__select {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  padding: var(--space-sm);
  font: inherit;
}

.refine-panel__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.refine-panel__rating-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.refine-panel__rating-value {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-accent);
}

.refine-panel__slider {
  width: 100%;
  accent-color: var(--color-accent);
}
</style>