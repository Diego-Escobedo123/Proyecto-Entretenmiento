<script setup lang="ts">
/**
 * YearReview — resumen del año a partir del diario (como el Year in Review
 * de Letterboxd): cuánto terminaste, en qué meses, qué géneros y qué fue lo
 * mejor según tus calificaciones.
 * Orden: cifras → metas (slot `goals`, para responder "¿y cuánto me propuse?")
 * → lo mejor del año → terminadas por mes y géneros, lado a lado.
 *
 * Uso:
 *   <YearReview :year="2026" :logs="logs" @open="abrirFicha">
 *     <template #goals><YearGoals :year="2026" :logs="logs" /></template>
 *   </YearReview>
 */
import { coverOk, vCover } from '../lib/cover'
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from './BaseIcon.vue'
import EmptyState from './EmptyState.vue'
import MonthlyChart from './MonthlyChart.vue'
import RatingStars from './RatingStars.vue'
import StatCard from './StatCard.vue'
import { MEDIA_TYPES, typeMeta } from '../lib/catalog'
import { yearStats } from '../lib/yearStats'
import { useInView } from '../composables/useInView'
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

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Para el encabezado de la gráfica: el mes más activo y el promedio por mes ya transcurrido. */
const monthSummary = computed(() => {
  const per = stats.value.perMonth
  const peakCount = Math.max(...per)
  const now = new Date()
  const months = props.year === now.getFullYear() ? now.getMonth() + 1 : 12
  return {
    peakName: MONTH_NAMES[per.indexOf(peakCount)],
    peakCount,
    average: (stats.value.total / months).toLocaleString('es', { maximumFractionDigits: 1 }),
  }
})

/** Las barras de géneros se llenan cuando la lista entra en pantalla. */
const genresEl = ref<HTMLElement | null>(null)
const genresInView = useInView(genresEl)
</script>

<template>
  <!-- Sin nada terminado: las metas igual (se pueden agregar) y el aviso -->
  <template v-if="!stats.total">
    <slot name="goals" />
    <EmptyState
      icon="bar-chart"
      :title="`Aún no terminas nada en ${year}`"
      text="Tu resumen del año se arma solo con lo que registras en el diario."
    />
  </template>

  <!-- Orden: cifras → metas (responden a las cifras) → lo mejor → ritmo y géneros -->
  <div v-else class="review">
    <div class="review__cards">
      <StatCard v-for="c in cards" :key="c.label" :icon="c.icon" :value="c.value" :label="c.label" />
    </div>

    <slot name="goals" />

    <!-- Lo mejor del año: a todo el ancho, con las portadas grandes -->
    <section v-if="stats.topRated.length" class="review__section">
      <div>
        <h2 class="review__title">Lo mejor del año</h2>
        <p class="review__hint">Mejor calificadas; la más reciente primero.</p>
      </div>
      <ol class="review__top">
        <li v-for="(t, i) in stats.topRated" :key="t.log.id" class="mosaic-enter" :style="{ '--i': i }">
          <button type="button" class="review__work" @click="$emit('open', t.log)">
            <span class="review__cover-wrap">
              <img v-if="coverOk(t.log.entry!.cover)" v-cover="t.log.entry!.cover" :src="t.log.entry!.cover" alt="" class="review__cover" />
              <span v-else class="review__cover review__cover--empty" aria-hidden="true">
                <BaseIcon :name="typeMeta(t.log.entry!.type).icon" />
              </span>
              <span class="review__rank" :class="{ 'is-first': i === 0 }">{{ i + 1 }}</span>
            </span>
            <span class="review__work-title">{{ t.log.entry!.title }}</span>
            <RatingStars :value="t.rating" />
          </button>
        </li>
      </ol>
    </section>

    <!-- Ritmo y géneros: dos tarjetas lado a lado, de la misma altura -->
    <div class="review__columns">
      <section class="review__panel">
        <header class="review__panel-head">
          <h2 class="review__title"><BaseIcon name="bar-chart-fill" /> Terminadas por mes</h2>
          <p class="review__panel-sub">
            Mes más activo: <strong>{{ monthSummary.peakName }}</strong> ({{ monthSummary.peakCount }})
            · {{ monthSummary.average }} al mes
          </p>
        </header>
        <MonthlyChart :values="stats.perMonth" :year="year" />
      </section>

      <section v-if="stats.topGenres.length" class="review__panel">
        <header class="review__panel-head">
          <h2 class="review__title"><BaseIcon name="tags-fill" /> Tus géneros</h2>
          <p class="review__panel-sub">Los que más terminaste en {{ year }}</p>
        </header>

        <ol ref="genresEl" class="review__genres" :class="{ 'is-revealed': genresInView }">
          <li v-for="(g, i) in stats.topGenres" :key="g.name" class="review__genre" :style="{ '--i': i }">
            <span class="review__genre-rank" :class="{ 'is-first': i === 0 }">{{ i + 1 }}</span>
            <span class="review__genre-body">
              <span class="review__genre-line">
                <span class="review__genre-name">{{ g.name }}</span>
                <span class="review__genre-count">{{ g.count }} {{ g.count === 1 ? 'obra' : 'obras' }}</span>
              </span>
              <span class="review__genre-track">
                <span
                  class="review__genre-bar"
                  :class="{ 'is-first': i === 0 }"
                  :style="{ width: `${(g.count / stats.topGenres[0].count) * 100}%` }"
                />
              </span>
            </span>
          </li>
        </ol>

        <p v-if="stats.abandoned" class="review__note">
          <BaseIcon name="pause-circle" />
          Dejaste {{ stats.abandoned }} {{ stats.abandoned === 1 ? 'obra' : 'obras' }} a medias
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
  gap: var(--space-lg);
}

/* Cómo se ordena "Lo mejor del año" (debajo del título). */
.review__hint {
  margin-top: 4px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

/* Lo mejor del año: fila de portadas (hasta 5), del ancho de la pantalla. */
.review__top {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-md);
}

.review__work {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.review__cover-wrap {
  position: relative;
  display: block;
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) ease;
}

.review__work:hover .review__cover-wrap,
.review__work:focus-visible .review__cover-wrap {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
}

.review__cover {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  background: var(--color-surface-2);
}

.review__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--color-text-subtle);
}

/* Puesto: número sobre la esquina de la portada; el 1.º, dorado. */
.review__rank {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  display: grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.6);
  color: var(--fig-cream);
  font-size: 0.875rem;
  font-weight: 800;
}

.review__rank.is-first {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.review__work-title {
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Terminadas por mes y Tus géneros: tarjetas de la misma altura --- */

.review__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.review__panel-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review__panel .review__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 1rem;
}

.review__panel .review__title .bi {
  color: var(--color-accent);
}

.review__panel-sub {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.review__panel-sub strong {
  color: var(--color-text);
  text-transform: capitalize;
}

/* Géneros: ranking con barra proporcional al 1.º. */
.review__genres {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.review__genre {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.review__genre-rank {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.review__genre-rank.is-first {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.review__genre-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review__genre-line {
  display: flex;
  justify-content: space-between;
  gap: var(--space-sm);
  font-size: 0.875rem;
}

.review__genre-name {
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review__genre-count {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.review__genre-track {
  height: 8px;
  border-radius: 999px;
  background: var(--color-surface-2);
  overflow: hidden;
}

/* Se llenan en cascada cuando la lista entra en pantalla. */
.review__genre-bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent) 50%, var(--color-surface-2));
  transform-origin: left;
  animation: review-genre-fill 600ms var(--ease-out) both paused;
  animation-delay: calc(var(--i, 0) * 80ms);
}

.review__genre-bar.is-first {
  background: var(--color-accent);
}

.review__genres.is-revealed .review__genre-bar {
  animation-play-state: running;
}

@keyframes review-genre-fill {
  from {
    transform: scaleX(0);
  }
}

/* Abandonadas: etiqueta pequeña al final de la tarjeta. */
.review__note {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: auto 0 0;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-surface-2);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}
</style>
