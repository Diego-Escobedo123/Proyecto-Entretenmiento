<script setup lang="ts">
/**
 * DnaOverview — "ADN cultural" completo del perfil público: dona de géneros,
 * década favorita sobre una línea de tiempo, formato dominante con el resto
 * de los tipos, y tres insights (constancia, calificaciones y el día más
 * intenso del último año). `self` pasa los textos a segunda persona.
 * Se adapta al ancho de su tarjeta (container queries), no al de la ventana.
 *
 * Uso:
 *   <DnaOverview :dna="profile.dna" :ratings="profile.ratings" :activity="profile.activity"
 *                :last-abandoned="profile.lastAbandoned" self />
 */
import { computed } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import { typeMeta } from '../../lib/catalog'
import { parseISODay } from '../../lib/dates'
import { GENRE_COLORS, OTHER_GENRES_COLOR, OTHER_GENRES_LABEL } from '../../lib/genreColors'
import type { ActivityEvent, PublicProfile } from '../../types/review'
import type { MediaType } from '../../types/media'

const props = defineProps<{
  dna: PublicProfile['dna']
  ratings: PublicProfile['ratings']
  activity: ActivityEvent[]
  lastAbandoned: string | null
  self?: boolean
}>()

/** Verbo en 2.ª persona (self) o 3.ª: v('completas', 'completa'). */
const v = (tu: string, el: string) => (props.self ? tu : el)

// --- Dona de géneros ---
const otherPercent = computed(() => {
  if (!props.dna.topGenres.length) return 0
  return Math.max(0, 100 - props.dna.topGenres.reduce((sum, g) => sum + g.percent, 0))
})

const legend = computed(() => [
  ...props.dna.topGenres.map((g, i) => ({ name: g.name, percent: g.percent, color: GENRE_COLORS[i] })),
  ...(otherPercent.value > 0 ? [{ name: OTHER_GENRES_LABEL, percent: otherPercent.value, color: OTHER_GENRES_COLOR }] : []),
])

const donutGradient = computed(() => {
  if (!legend.value.length) return `conic-gradient(${OTHER_GENRES_COLOR} 0% 100%)`
  let acc = 0
  // 1% de separación entre porciones, del color de la tarjeta.
  const stops = legend.value.flatMap((g) => {
    const start = acc
    acc += g.percent
    return [`${g.color} ${start}% ${Math.max(start, acc - 1)}%`, `var(--color-surface) ${Math.max(start, acc - 1)}% ${acc}%`]
  })
  return `conic-gradient(${stops.join(', ')})`
})

// --- Década favorita ---
const decadeLabel = (d: number) => `${String(d % 100).padStart(2, '0')}s`

/** Seis décadas alrededor de la favorita, terminando como mucho en la actual. */
const decades = computed(() => {
  const fav = props.dna.favoriteDecade?.decade
  const current = Math.floor(new Date().getFullYear() / 10) * 10
  if (fav == null) return []
  const all: number[] = []
  for (let d = Math.min(fav, current - 50); d <= current; d += 10) all.push(d)
  const i = all.indexOf(fav)
  const from = Math.max(0, Math.min(i - 3, all.length - 6))
  return all.slice(from, from + 6)
})

// --- Formato dominante ---
const dominant = computed(() => props.dna.typeShares[0] ?? null)
const secondaryTypes = computed(() => props.dna.typeShares.slice(1, 3))

// --- Insight: constancia ---
const completion = computed(() => props.dna.completionRate)
const completionDots = computed(() => Math.round(completion.value / 10))
const completionText = computed(() => {
  const r = completion.value
  if (r >= 90) return `${v('Terminas', 'Termina')} casi todo lo que ${v('empiezas', 'empieza')}.`
  if (r >= 60) return `${v('Terminas', 'Termina')} la mayoría de lo que ${v('empiezas', 'empieza')}.`
  if (r >= 40) return `${v('Completas', 'Completa')} ${r === 50 ? 'la' : 'cerca de la'} mitad de lo que ${v('empiezas', 'empieza')}.`
  return `${v('Dejas', 'Deja')} a medias buena parte de lo que ${v('empiezas', 'empieza')}.`
})

// --- Insight: calificaciones (histograma de ½ a 5; índices 7–9 = 4, 4½ y 5) ---
const highRatings = computed(() => props.ratings.histogram.slice(7).reduce((a, b) => a + b, 0))
const ratingVerdict = computed(() => {
  const share = highRatings.value / props.ratings.count
  if (share >= 0.7) return `${v('Eres', 'Es')} de mano generosa.`
  if (share <= 0.3) return `${v('Eres', 'Es')} de estrellas difíciles.`
  return `${v('Repartes', 'Reparte')} las estrellas con equilibrio.`
})
/** Estrellas del promedio, de a media. */
const averageStars = computed(() => {
  const avg = props.ratings.average ?? 0
  return Array.from({ length: 5 }, (_, i) => (avg >= i + 1 ? 'star-fill' : avg >= i + 0.5 ? 'star-half' : 'star'))
})

// --- Insight: día más intenso ---
const NUMBER_WORDS = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco']

/** "una serie", "dos películas", "un álbum"… */
function countType(type: MediaType, n: number): string {
  const meta = typeMeta(type)
  if (n === 1) return `${meta.gender === 'f' ? 'una' : 'un'} ${meta.label.toLowerCase()}`
  return `${NUMBER_WORDS[n] ?? n} ${meta.plural.toLowerCase()}`
}

function joinList(items: string[]): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

const busiestDay = computed(() => {
  const byDay = new Map<string, Map<string, MediaType>>()
  for (const e of props.activity) {
    const works = byDay.get(e.date) ?? new Map<string, MediaType>()
    works.set(e.title, e.type)
    byDay.set(e.date, works)
  }
  // El que tenga más obras distintas; si empatan, el más reciente.
  const [date, works] =
    [...byDay.entries()].sort((a, b) => b[1].size - a[1].size || b[0].localeCompare(a[0]))[0] ?? []
  if (!date || !works) return null

  const byType = new Map<MediaType, number>()
  for (const type of works.values()) byType.set(type, (byType.get(type) ?? 0) + 1)
  const d = parseISODay(date)
  return {
    month: d.toLocaleDateString('es', { month: 'short' }).replace('.', '').slice(0, 3).toUpperCase(),
    day: d.getDate(),
    count: works.size,
    detail: joinList([...byType.entries()].map(([type, n]) => countType(type, n))),
  }
})
</script>

<template>
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">ADN cultural</h2>
      <span class="card__header-label" aria-hidden="true"><BaseIcon name="diagram-3" /></span>
    </div>

    <div class="ov">
      <div class="ov__top">
        <!-- Géneros -->
        <div class="ov__genres">
          <div class="donut" :style="{ background: donutGradient }" role="img" :aria-label="legend.map((g) => `${g.name} ${g.percent}%`).join(', ') || 'Sin géneros'">
            <div class="donut__hole">
              <template v-if="dna.topGenres.length">
                <strong>{{ dna.topGenres[0].percent }}%</strong>
                <span>{{ dna.topGenres[0].name }}</span>
              </template>
              <span v-else>Sin géneros</span>
            </div>
          </div>
          <ul v-if="legend.length" class="donut__legend">
            <li v-for="g in legend" :key="g.name">
              <span class="donut__dot" :style="{ background: g.color }" />
              {{ g.name }} ({{ g.percent }}%)
            </li>
          </ul>
        </div>

        <!-- Década favorita -->
        <div class="ov__fact">
          <h3 class="ov__kicker">Década favorita</h3>
          <template v-if="dna.favoriteDecade">
            <p class="ov__big ov__big--accent">’{{ decadeLabel(dna.favoriteDecade.decade) }}</p>
            <p class="ov__caption">el {{ dna.favoriteDecade.percent }}% de todo lo que {{ v('registras', 'registra') }}</p>
            <ol class="timeline" aria-hidden="true">
              <li
                v-for="d in decades"
                :key="d"
                class="timeline__stop"
                :class="{ 'is-current': d === dna.favoriteDecade.decade }"
              >
                <span class="timeline__dot" />
                <span class="timeline__label">{{ decadeLabel(d) }}</span>
              </li>
            </ol>
          </template>
          <p v-else class="ov__caption">Sin datos aún</p>
        </div>

        <!-- Formato dominante -->
        <div class="ov__fact">
          <h3 class="ov__kicker">Formato dominante</h3>
          <template v-if="dominant">
            <BaseIcon :name="typeMeta(dominant.type).icon" class="ov__type-icon" />
            <p class="ov__big">{{ typeMeta(dominant.type).plural }}</p>
            <p class="ov__caption">{{ dominant.percent }}% de {{ v('tus', 'sus') }} obras</p>
            <ul v-if="secondaryTypes.length" class="ov__types">
              <li v-for="t in secondaryTypes" :key="t.type">
                <BaseIcon :name="typeMeta(t.type).icon" /> {{ typeMeta(t.type).plural }} {{ t.percent }}%
              </li>
            </ul>
          </template>
          <p v-else class="ov__caption">Sin datos suficientes</p>
        </div>
      </div>

      <h3 class="ov__subtitle">Insights</h3>
      <div class="ov__insights">
        <article class="insight insight--constancy">
          <h4 class="insight__kicker">Constancia</h4>
          <div class="insight__dots" aria-hidden="true">
            <span v-for="n in 10" :key="n" class="insight__dot" :class="{ 'is-on': n <= completionDots }" />
          </div>
          <p class="insight__value">{{ completion }}%</p>
          <p class="insight__text">
            {{ completionText }}
            <template v-if="lastAbandoned">Último abandono: <em>{{ lastAbandoned }}</em>.</template>
          </p>
        </article>

        <article class="insight insight--ratings">
          <h4 class="insight__kicker">Calificaciones</h4>
          <div class="insight__stars" aria-hidden="true">
            <BaseIcon v-for="(icon, i) in averageStars" :key="i" :name="icon" />
          </div>
          <template v-if="ratings.count">
            <p class="insight__value">{{ highRatings }} de {{ ratings.count }}</p>
            <p class="insight__text">
              de {{ v('tus', 'sus') }} notas son de 4<BaseIcon name="star-fill" class="insight__inline-star" /> o más.
              {{ ratingVerdict }}
            </p>
          </template>
          <template v-else>
            <p class="insight__value">—</p>
            <p class="insight__text">Todavía no hay calificaciones.</p>
          </template>
        </article>

        <article class="insight insight--day">
          <h4 class="insight__kicker">{{ v('Tu', 'Su') }} día más intenso</h4>
          <template v-if="busiestDay">
            <div class="insight__calendar" aria-hidden="true">
              <span class="insight__calendar-month">{{ busiestDay.month }}</span>
              <span class="insight__calendar-day">{{ busiestDay.day }}</span>
            </div>
            <p class="insight__value">{{ busiestDay.count }} {{ busiestDay.count === 1 ? 'obra' : 'obras' }}</p>
            <p class="insight__text">
              {{ busiestDay.count === 1 ? 'ese día' : 'en un solo día' }}: {{ busiestDay.detail }}.
            </p>
          </template>
          <template v-else>
            <p class="insight__value">—</p>
            <p class="insight__text">Sin registros en el último año.</p>
          </template>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  height: 100%;
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
}

/* Se acomoda al ancho de la tarjeta. */
.ov {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/*
 * Teléfono (tarjeta angosta): todo en una columna.
 * Escritorio (desde 400px de tarjeta): como el diseño, dona | década | formato
 * y los tres insights en fila; tamaños y rellenos se escalan con el ancho
 * de la tarjeta (cqi) para que quepa igual a 1280px que a 1920px.
 */
.ov__top {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}

.ov__genres {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

@container (min-width: 400px) {
  .ov__top {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(8px, 2cqi, 16px);
  }

  .ov__genres .donut__legend {
    grid-template-columns: auto;
    font-size: clamp(0.6875rem, 1.9cqi, 0.8125rem);
  }

  .ov__genres .donut__legend li {
    white-space: normal;
  }
}

/* --- Dona --- */
.donut {
  width: min(150px, 100%);
  aspect-ratio: 1;
  flex-shrink: 0;
  border-radius: 50%;
  position: relative;
}

.donut__hole {
  position: absolute;
  inset: 13%;
  border-radius: 50%;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
}

.donut__hole strong {
  color: var(--color-text);
  font-size: 1.625rem;
  font-weight: 800;
  line-height: 1.1;
}

.donut__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: var(--space-xs) var(--space-md);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.donut__legend li {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.donut__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* --- Década y formato --- */
.ov__fact {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface-2) 60%, var(--color-surface));
}

.ov__kicker,
.insight__kicker {
  margin: 0 0 var(--space-sm);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.ov__big {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.75rem;
  font-weight: 900;
  line-height: 1.1;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.ov__big--accent {
  font-size: 3rem;
  color: var(--color-accent);
}

.ov__caption {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.ov__type-icon {
  font-size: 2.25rem;
  color: var(--color-accent);
  line-height: 1;
  margin-bottom: var(--space-xs);
}

.ov__types {
  list-style: none;
  margin: auto 0 0;
  padding: var(--space-sm) 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-md);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.ov__types li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Línea de tiempo de décadas: la favorita resaltada. */
.timeline {
  list-style: none;
  margin: auto 0 0;
  padding: var(--space-md) 0 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  position: relative;
}

.timeline::before {
  content: '';
  position: absolute;
  top: calc(var(--space-md) + 7px);
  left: 8%;
  right: 8%;
  height: 2px;
  background: var(--color-border);
}

.timeline__stop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
}

.timeline__dot {
  width: 8px;
  height: 8px;
  margin: 3px 0;
  border-radius: 50%;
  background: var(--color-text-subtle);
}

.timeline__stop.is-current .timeline__dot {
  width: 14px;
  height: 14px;
  margin: 0;
  background: var(--color-accent);
  box-shadow: 0 0 0 4px var(--color-accent-bg);
}

.timeline__stop.is-current .timeline__label {
  color: var(--color-accent);
  font-weight: 700;
}

/* --- Insights --- */
.ov__subtitle {
  margin: var(--space-xs) 0 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}

.ov__insights {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}


.insight {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  border-radius: var(--radius-md);
}

.insight--constancy {
  background: color-mix(in srgb, var(--burnt-copper) 14%, var(--color-surface-2));
  color: var(--color-text);
}

.insight--constancy .insight__kicker {
  color: var(--color-accent);
}

.insight--ratings {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.insight--day {
  background: var(--rose);
  color: var(--color-accent-contrast);
}

.insight--ratings .insight__kicker,
.insight--day .insight__kicker {
  color: color-mix(in srgb, var(--color-accent-contrast) 75%, transparent);
}

.insight__dots {
  display: grid;
  grid-template-columns: repeat(5, 11px);
  gap: 5px;
}

.insight__dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1.5px solid var(--color-text-subtle);
}

.insight__dot.is-on {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.insight__stars {
  display: flex;
  gap: 4px;
  font-size: 0.9375rem;
}

.insight__calendar {
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  width: 42px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--fig-cream);
  text-align: center;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.15);
}

.insight__calendar-month {
  padding: 1px 0;
  background: var(--deep-raspberry);
  color: var(--fig-cream);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.insight__calendar-day {
  padding: 1px 0 3px;
  color: var(--fig-purple);
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.1;
}

.insight__value {
  font-family: var(--font-sans);
  margin: auto 0 2px;
  padding-top: var(--space-sm);
  font-size: 1.625rem;
  font-weight: 800;
  line-height: 1.1;
}

.insight__text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 0.75rem;
  line-height: 1.45;
}

.insight__inline-star {
  font-size: 0.7em;
  vertical-align: 0.1em;
}

/* Escritorio: al final para ganarle a las reglas base (misma especificidad). */
@container (min-width: 400px) {
  .ov__insights {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(8px, 2cqi, 16px);
  }

  .ov__fact {
    padding: clamp(10px, 2.4cqi, 16px);
  }

  .insight {
    padding: clamp(8px, 1.9cqi, 12px);
  }

  .ov__big {
    font-size: clamp(1.125rem, 4cqi, 1.75rem);
  }

  .ov__big--accent {
    font-size: clamp(1.75rem, 6.5cqi, 3rem);
  }

  .ov__caption {
    font-size: clamp(0.6875rem, 1.9cqi, 0.8125rem);
  }

  .insight__text {
    font-size: clamp(0.625rem, 1.7cqi, 0.75rem);
  }

  .ov__type-icon {
    font-size: clamp(1.5rem, 5cqi, 2.25rem);
  }

  .ov__kicker,
  .insight__kicker {
    font-size: clamp(0.5625rem, 1.6cqi, 0.6875rem);
    letter-spacing: 0.08em;
  }

  .insight__value {
    font-size: clamp(1.0625rem, 3.7cqi, 1.625rem);
  }

  .insight__dots {
    grid-template-columns: repeat(5, clamp(8px, 1.8cqi, 11px));
    gap: clamp(3px, 0.8cqi, 5px);
  }

  .insight__dot {
    width: clamp(8px, 1.8cqi, 11px);
    height: clamp(8px, 1.8cqi, 11px);
  }

  .timeline__stop {
    font-size: clamp(0.5625rem, 1.6cqi, 0.6875rem);
  }

  .ov__types {
    flex-direction: column;
    font-size: clamp(0.6875rem, 1.9cqi, 0.8125rem);
  }
}

/* Tarjeta de década angosta: 4 décadas en vez de 6 (sin tocar la favorita). */
@container (min-width: 400px) and (max-width: 560px) {
  .timeline__stop:first-child:not(.is-current),
  .timeline__stop:last-child:not(.is-current) {
    display: none;
  }
}
</style>
