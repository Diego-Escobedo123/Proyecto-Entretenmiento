<script setup lang="ts">
/**
 * YearReview — resumen del año a partir del diario (como el Year in Review
 * de Letterboxd): cuánto terminaste, en qué meses, qué géneros y qué fue lo
 * mejor según tus calificaciones.
 *
 * Uso:
 *   <YearReview :year="2026" :logs="logs" @open="abrirFicha" />
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from './BaseIcon.vue'
import EmptyState from './EmptyState.vue'
import MonthlyChart from './MonthlyChart.vue'
import RatingStars from './RatingStars.vue'
import StatCard from './StatCard.vue'
import { MEDIA_TYPES, typeMeta } from '../lib/catalog'
import { yearStats } from '../lib/yearStats'
import { useMediaStore } from '../stores/media'
import type { LogEntry } from '../types/log'

const props = defineProps<{ year: number; logs: LogEntry[] }>()
defineEmits<{ open: [log: LogEntry] }>()

const { entries } = storeToRefs(useMediaStore())

const stats = computed(() => yearStats(props.logs, props.year, entries.value))

const cards = computed(() => {
  const s = stats.value
  const list: { icon: string; value: string | number; label: string }[] = [
    { icon: 'check2-circle', value: s.total, label: s.total === 1 ? 'Obra terminada' : 'Obras terminadas' },
  ]
  for (const t of MEDIA_TYPES) {
    if (s.byType[t.value]) list.push({ icon: t.icon, value: s.byType[t.value], label: t.plural })
  }
  if (s.pages) list.push({ icon: 'file-earmark-text', value: s.pages.toLocaleString('es'), label: 'Páginas leídas' })
  if (s.hours) {
    list.push({ icon: 'hourglass-split', value: s.hours.toLocaleString('es', { maximumFractionDigits: 1 }), label: 'Horas jugadas' })
  }
  if (s.averageRating != null) {
    list.push({ icon: 'star', value: s.averageRating.toLocaleString('es', { maximumFractionDigits: 1 }), label: 'Calificación promedio' })
  }
  if (s.repeats) list.push({ icon: 'arrow-repeat', value: s.repeats, label: s.repeats === 1 ? 'Vez que repetiste' : 'Veces que repetiste' })
  return list
})
</script>

<template>
  <EmptyState
    v-if="!stats.total"
    icon="bar-chart"
    :title="`Aún no terminas nada en ${year}`"
    text="Tu resumen del año se arma solo con lo que registras en el diario."
  />

  <div v-else class="review">
    <div class="review__cards">
      <StatCard v-for="c in cards" :key="c.label" :icon="c.icon" :value="c.value" :label="c.label" />
    </div>

    <section class="review__section">
      <h2 class="review__title">Terminadas por mes</h2>
      <MonthlyChart :values="stats.perMonth" />
    </section>

    <div class="review__columns">
      <section v-if="stats.topRated.length" class="review__section">
        <h2 class="review__title">Lo mejor del año</h2>
        <ol class="review__top">
          <li v-for="(t, i) in stats.topRated" :key="t.log.id">
            <button type="button" class="review__work" @click="$emit('open', t.log)">
              <span class="review__rank">{{ i + 1 }}</span>
              <img v-if="t.log.entry!.cover" :src="t.log.entry!.cover" alt="" class="review__cover" />
              <span v-else class="review__cover review__cover--empty" aria-hidden="true">
                <BaseIcon :name="typeMeta(t.log.entry!.type).icon" />
              </span>
              <span class="review__work-info">
                <span class="review__work-title">{{ t.log.entry!.title }}</span>
                <RatingStars :value="t.rating" />
              </span>
            </button>
          </li>
        </ol>
      </section>

      <section v-if="stats.topGenres.length" class="review__section">
        <h2 class="review__title">Tus géneros</h2>
        <ul class="review__genres">
          <li v-for="g in stats.topGenres" :key="g.name" class="review__genre">
            <span>{{ g.name }}</span>
            <span class="review__genre-count">{{ g.count }}</span>
          </li>
        </ul>
        <p v-if="stats.abandoned" class="review__note">
          Y dejaste {{ stats.abandoned }} {{ stats.abandoned === 1 ? 'obra' : 'obras' }} a medias.
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.review {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.review__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--space-md);
}

.review__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.review__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-text);
}

.review__columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-xl);
}

.review__top {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review__work {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.review__work:hover,
.review__work:focus-visible {
  border-color: var(--color-border);
}

.review__rank {
  width: 1.5ch;
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-text-muted);
}

.review__cover {
  width: 40px;
  height: 60px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface-2);
}

.review__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
}

.review__work-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review__work-title {
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review__genres {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.review__genre {
  display: flex;
  justify-content: space-between;
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
}

.review__genre-count {
  font-weight: 700;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.review__note {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
</style>
