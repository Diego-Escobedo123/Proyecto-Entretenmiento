<script setup lang="ts">
/**
 * DnaCard — "ADN cultural": dona con los 3 géneros más frecuentes, década
 * favorita, formato dominante y qué tanto termina lo que empieza. Sirve para
 * el perfil propio y para perfiles públicos ajenos (`self` ajusta el texto).
 *
 * Uso:
 *   <DnaCard :top-genres="…" :favorite-decade="…" dominant-label="Películas" :completion-rate="62" self />
 */
import { computed } from 'vue'
import BaseIcon from '../BaseIcon.vue'

const props = defineProps<{
  topGenres: { name: string; count: number; percent: number }[]
  favoriteDecade: { decade: number; percent: number } | null
  /** Plural del tipo más registrado ("Películas"), o null si no hay datos. */
  dominantLabel: string | null
  completionRate: number
  self?: boolean
}>()

const genreColors = ['var(--color-accent)', 'var(--fig-stem-green)', 'var(--rose)']

const donutGradient = computed(() => {
  if (!props.topGenres.length) return 'conic-gradient(var(--color-border) 0% 100%)'
  let acc = 0
  const stops = props.topGenres.map((g, i) => {
    const start = acc
    acc += g.percent
    return `${genreColors[i % genreColors.length]} ${start}% ${acc}%`
  })
  if (acc < 100) stops.push(`var(--color-border) ${acc}% 100%`)
  return `conic-gradient(${stops.join(', ')})`
})
</script>

<template>
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">ADN cultural</h2>
      <span class="card__header-label"><BaseIcon name="diagram-3" /></span>
    </div>
    <div class="dna">
      <template v-if="topGenres.length">
        <div class="donut" :style="{ background: donutGradient }">
          <div class="donut__hole">
            <strong>{{ topGenres[0].percent }}%</strong>
            <span>{{ topGenres[0].name }}</span>
          </div>
        </div>
        <ul class="donut__legend">
          <li v-for="(g, i) in topGenres" :key="g.name">
            <span class="donut__dot" :style="{ background: genreColors[i % genreColors.length] }" />
            {{ g.name }}<template v-if="i > 0"> ({{ g.percent }}%)</template>
          </li>
        </ul>
      </template>
      <p v-else class="dna__value">
        {{ self ? 'Aún sin géneros: agrégalos al registrar obras.' : 'Aún sin géneros registrados.' }}
      </p>

      <div class="dna__row">
        <div class="dna__field">
          <h4 class="dna__label">Década favorita</h4>
          <p class="dna__value">
            <template v-if="favoriteDecade">Los {{ favoriteDecade.decade }}s — {{ favoriteDecade.percent }}%</template>
            <template v-else>Sin datos aún</template>
          </p>
        </div>
        <div class="dna__field">
          <h4 class="dna__label">Formato dominante</h4>
          <p class="dna__value">{{ dominantLabel ?? 'Sin datos suficientes' }}</p>
        </div>
      </div>

      <p class="dna__insight">
        <strong>Insight:</strong> {{ self ? 'completas' : 'completa' }} el {{ completionRate }}% de las obras que
        {{ self ? 'empiezas' : 'empieza' }}.
      </p>
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
  display: flex;
  align-items: center;
  gap: var(--space-sm);
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

.dna {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.donut {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  position: relative;
  margin: 0 auto;
}

.donut__hole {
  position: absolute;
  inset: 16px;
  border-radius: 50%;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.donut__hole strong {
  color: var(--color-text);
  font-size: 1.375rem;
  font-weight: 800;
}

.donut__hole span {
  color: var(--color-text-subtle);
  font-size: 0.75rem;
}

.donut__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm) var(--space-md);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.donut__legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.donut__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dna__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-md);
}

.dna__label {
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0 0 var(--space-xs) 0;
}

.dna__value {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0;
}

.dna__insight {
  background: var(--color-accent-bg);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  margin: 0;
  line-height: 1.5;
}

.dna__insight strong {
  color: var(--color-accent);
}
</style>
