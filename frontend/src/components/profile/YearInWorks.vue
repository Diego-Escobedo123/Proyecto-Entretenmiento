<script setup lang="ts">
/**
 * YearInWorks — "Tu año en obras": una barra por semana del último año,
 * reflejada sobre una línea central. El alto de las barras es siempre la
 * misma onda (decorativa, como una hélice de ADN), no un dato: lo que cuenta
 * es el color. Las semanas con registros van con los tramos de los géneros
 * del ADN (mismos colores que la dona; el resto, "Otros"); las demás, en
 * gris. Tooltip por barra con cuántos registros hubo; arranca mostrando la
 * última semana con actividad.
 *
 * Uso:
 *   <YearInWorks :activity="profile.activity" :top-genres="['Drama', 'Comedia']" self />
 */
import { computed, ref } from 'vue'
import { faDna } from '@fortawesome/free-solid-svg-icons'
import FaIcon from '../FaIcon.vue'
import { isoDay, parseISODay } from '../../lib/dates'
import { GENRE_COLORS, OTHER_GENRES_COLOR, OTHER_GENRES_LABEL } from '../../lib/genreColors'
import type { ActivityEvent } from '../../types/review'

const props = defineProps<{ activity: ActivityEvent[]; topGenres: string[]; self?: boolean }>()

/** Género de un registro: el mejor ubicado en el top del ADN, o "Otros". */
function genreIndex(e: ActivityEvent): number {
  const ranks = e.genres.map((g) => props.topGenres.indexOf(g)).filter((i) => i >= 0 && i < GENRE_COLORS.length)
  return ranks.length ? Math.min(...ranks) : GENRE_COLORS.length
}

const categories = computed(() => [
  ...props.topGenres.slice(0, GENRE_COLORS.length).map((name, i) => ({ name, color: GENRE_COLORS[i] })),
  { name: OTHER_GENRES_LABEL, color: OTHER_GENRES_COLOR },
])

const shortDate = (d: Date) => d.toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '')

interface Week {
  start: Date
  events: ActivityEvent[]
  /** Registros por categoría (índice de `categories`), sólo las que tienen. */
  segments: { index: number; count: number }[]
}

/** Semanas de domingo a sábado, del último año hasta la actual. */
const weeks = computed<Week[]>(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - 364)
  start.setDate(start.getDate() - start.getDay())

  const out: Week[] = []
  for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 7)) {
    out.push({ start: new Date(cursor), events: [], segments: [] })
  }
  const first = isoDay(start)
  for (const e of props.activity) {
    if (e.date < first) continue
    const i = Math.floor((parseISODay(e.date).getTime() - start.getTime()) / (7 * 86_400_000))
    out[Math.min(i, out.length - 1)]?.events.push(e)
  }
  for (const w of out) {
    const counts = new Map<number, number>()
    for (const e of w.events) counts.set(genreIndex(e), (counts.get(genreIndex(e)) ?? 0) + 1)
    w.segments = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([index, count]) => ({ index, count }))
  }
  return out
})

/** Alto de la barra en % del área (la más alta llega al 100%; ninguna con datos baja del 18%). */
/**
 * Alto (%) de la barra de la semana i: una onda suave (dos cosenos), igual
 * haya o no registros. Es la forma del gráfico, no un dato.
 */
const waveHeight = (i: number) => {
  const wave = 0.5 + 0.5 * Math.cos((2 * Math.PI * i) / 8.5) + 0.18 * Math.cos((2 * Math.PI * i) / 2.9)
  return 22 + 78 * Math.min(1, Math.max(0, wave))
}

/** Etiqueta de mes en la primera semana de cada mes (como Constancia). */
const monthLabels = computed(() => {
  const labels: { column: number; label: string }[] = []
  let previous = -1
  weeks.value.forEach((w, i) => {
    const month = w.start.getMonth()
    if (month !== previous) {
      if (i > 0) {
        const text = w.start.toLocaleDateString('es', { month: 'short' }).replace('.', '')
        labels.push({ column: i, label: text.charAt(0).toUpperCase() + text.slice(1, 3) })
      }
      previous = month
    }
  })
  return labels.filter((l, i) => i === labels.length - 1 || labels[i + 1].column - l.column >= 3)
})

const total = computed(() => props.activity.length)

const busiestMonth = computed(() => {
  const byMonth = new Map<string, number>()
  for (const e of props.activity) byMonth.set(e.date.slice(0, 7), (byMonth.get(e.date.slice(0, 7)) ?? 0) + 1)
  const [key] = [...byMonth.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0] ?? []
  return key ? parseISODay(`${key}-01`).toLocaleDateString('es', { month: 'long' }) : null
})

/** Categorías que aparecen en el año (para la leyenda). */
const legend = computed(() => {
  const used = new Set(weeks.value.flatMap((w) => w.segments.map((s) => s.index)))
  return categories.value.filter((_, i) => used.has(i))
})

// --- Semana activa (hover / foco); por defecto, la última con registros ---
const hovered = ref<number | null>(null)
const lastActive = computed(() => {
  for (let i = weeks.value.length - 1; i >= 0; i--) if (weeks.value[i].events.length) return i
  return -1
})
const active = computed(() => hovered.value ?? (lastActive.value >= 0 ? lastActive.value : null))

function weekDateLabel(w: Week): string {
  const days = new Set(w.events.map((e) => e.date))
  if (days.size === 1) return shortDate(parseISODay([...days][0]))
  return `semana del ${shortDate(w.start)}`
}

const tooltip = computed(() => {
  if (active.value == null) return null
  const w = weeks.value[active.value]
  const titles = [...new Set(w.events.map((e) => e.title))]
  return {
    heading: `${w.events.length} ${w.events.length === 1 ? 'registro' : 'registros'} · ${weekDateLabel(w)}`,
    titles: titles.join(', '),
    /** Posición horizontal (%) y hacia qué lado se abre, para no salirse de la tarjeta. */
    left: ((active.value + 0.5) / weeks.value.length) * 100,
    align: active.value > weeks.value.length * 0.75 ? 'end' : active.value < weeks.value.length * 0.25 ? 'start' : 'center',
  }
})

const ariaWeek = (w: Week) =>
  `${weekDateLabel(w)}: ${w.events.length} ${w.events.length === 1 ? 'registro' : 'registros'} (${[...new Set(w.events.map((e) => e.title))].join(', ')})`
</script>

<template>
  <div class="card year">
    <div class="card__header">
      <h2 class="card__title">
        <!-- Bootstrap Icons no trae uno de ADN: va el de Font Awesome. -->
        <FaIcon :icon="faDna" />
        {{ self ? 'Tu' : 'Su' }} año en obras
      </h2>
      <p class="year__summary">
        <strong>{{ total }} {{ total === 1 ? 'registro' : 'registros' }} en el último año</strong>
        <template v-if="busiestMonth"> · mes más activo: <span class="year__month">{{ busiestMonth }}</span></template>
      </p>
    </div>

    <div class="year__chart">
      <div
        class="year__bars"
        :style="{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }"
        @mouseleave="hovered = null"
      >
        <template v-for="(w, i) in weeks" :key="i">
          <button
            v-if="w.events.length"
            type="button"
            class="year__week"
            :class="{ 'is-active': active === i }"
            :aria-label="ariaWeek(w)"
            @mouseenter="hovered = i"
            @focus="hovered = i"
            @blur="hovered = null"
          >
            <span class="year__bar" :style="{ height: `${waveHeight(i)}%` }">
              <span
                v-for="s in w.segments"
                :key="s.index"
                class="year__segment"
                :style="{ flexGrow: s.count, background: categories[s.index].color }"
              />
            </span>
          </button>
          <span v-else class="year__week year__week--empty" aria-hidden="true">
            <span class="year__stub" :style="{ height: `${waveHeight(i)}%` }" />
          </span>
        </template>
      </div>

      <div
        v-if="tooltip"
        class="year__tip"
        :class="`year__tip--${tooltip.align}`"
        :style="{ left: `${tooltip.left}%` }"
        role="status"
      >
        <strong>{{ tooltip.heading }}</strong>
        <span>{{ tooltip.titles }}</span>
      </div>

      <div class="year__months" :style="{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }" aria-hidden="true">
        <span v-for="m in monthLabels" :key="m.column" class="year__month-label" :style="{ gridColumn: m.column + 1 }">
          {{ m.label }}
        </span>
      </div>
    </div>

    <div class="year__footer">
      <span>Cada barra es una semana · en gris, las semanas sin registros</span>
      <ul v-if="legend.length" class="year__legend">
        <li v-for="c in legend" :key="c.name"><span class="year__dot" :style="{ background: c.color }" /> {{ c.name }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-md);
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

.year__summary {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.year__summary strong {
  color: var(--color-text);
}

.year__month {
  color: var(--color-accent);
  font-weight: 700;
}

.year__chart {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 220px;
  padding-top: 64px; /* lugar para el tooltip */
}

/* Barras centradas sobre una línea: la onda. */
.year__bars {
  position: relative;
  flex: 1;
  display: grid;
  gap: 2px;
  min-height: 140px;
}

.year__bars::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--color-border);
}

.year__week {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.year__week--empty {
  cursor: default;
}

.year__bar {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: min(100%, 10px);
  border-radius: 999px;
  overflow: hidden;
  transition: opacity 0.15s ease;
}

.year__segment {
  min-height: 3px;
}

.year__stub {
  width: min(100%, 10px);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text) 14%, var(--color-surface));
}

.year__bars:hover .year__week:not(.is-active) .year__bar {
  opacity: 0.55;
}

.year__week.is-active .year__bar {
  outline: 2px solid var(--color-text);
  outline-offset: 2px;
}

.year__week:focus-visible {
  outline: none;
}

.year__tip {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: min(280px, 90%);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--fig-cream);
  color: var(--fig-purple);
  font-size: 0.75rem;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
  pointer-events: none;
  z-index: 1;
}

.year__tip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: color-mix(in srgb, var(--fig-purple) 75%, transparent);
}

.year__tip--center {
  transform: translateX(-50%);
}

.year__tip--end {
  transform: translateX(-100%);
}

.year__months {
  display: grid;
  gap: 2px;
  margin-top: var(--space-sm);
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.year__month-label {
  width: 0;
  white-space: nowrap;
}

.year__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm) var(--space-md);
  padding-top: var(--space-md);
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
}

.year__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  color: var(--color-text-muted);
}

.year__legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.year__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
