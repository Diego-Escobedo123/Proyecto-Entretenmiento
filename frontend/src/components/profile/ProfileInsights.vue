<script setup lang="ts">
/**
 * ProfileInsights — banco de insights del perfil: se calculan todos los que
 * tengan datos y se muestran los 3 más llamativos, así cada perfil cuenta
 * algo distinto. Los colores de las tarjetas van por posición (oscura,
 * dorada, rosa), no por insight, para que la fila siempre se vea igual.
 *
 * Banco:
 *   against     Contra la corriente: su nota vs. la de Mosaic.  (servidor)
 *   speed       Velocidad: cuánto tarda en terminar algo.        (servidor)
 *   timeTravel  Viaje en el tiempo: la obra más vieja que vio.   (servidor)
 *   constancy   Constancia: qué parte de lo que empieza termina.
 *   ratings     Calificaciones: cuántas de sus notas son de 4★ o más.
 *   day         Su día más intenso del último año.
 *
 * Se adapta al ancho del contenedor (container queries de `.ov`, en DnaOverview).
 */
import { computed } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import { typeMeta } from '../../lib/catalog'
import { parseISODay } from '../../lib/dates'
import type { ActivityEvent, ProfileInsightsData, PublicProfile } from '../../types/review'
import type { MediaType } from '../../types/media'

const props = defineProps<{
  dna: PublicProfile['dna']
  ratings: PublicProfile['ratings']
  activity: ActivityEvent[]
  lastAbandoned: string | null
  insights: ProfileInsightsData | null
  self?: boolean
}>()

/** Verbo en 2.ª persona (self) o 3.ª: v('completas', 'completa'). */
const v = (tu: string, el: string) => (props.self ? tu : el)

const decimal = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })
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

/** "la"/"lo" según el tipo de obra (la película, el libro). */
const pronoun = (type: MediaType) => (typeMeta(type).gender === 'f' ? 'la' : 'lo')

/** "viste"/"vio", "leíste"/"leyó"… */
const SEEN: Record<MediaType, [string, string]> = {
  movie: ['viste', 'vio'],
  series: ['viste', 'vio'],
  book: ['leíste', 'leyó'],
  game: ['jugaste', 'jugó'],
  music: ['escuchaste', 'escuchó'],
}

// --- Contra la corriente ---
const against = computed(() => {
  const a = props.insights?.against
  if (!a) return null
  const gap = a.rating - a.community
  return {
    ...a,
    gap,
    /** Posición (%) en una escala de ½ a 5. */
    mine: ((a.rating - 0.5) / 4.5) * 100,
    theirs: ((a.community - 0.5) / 4.5) * 100,
    // Sin adjetivos con género: no sabemos el de la persona.
    verdict: props.self
      ? `Nadie ${pronoun(a.type)} ${gap > 0 ? 'defiende' : 'castiga'} como tú.`
      : `Pocos ${pronoun(a.type)} ${gap > 0 ? 'defienden' : 'castigan'} tanto.`,
  }
})

// --- Velocidad ---
const speed = computed(() => {
  const s = props.insights?.speed
  if (!s) return null
  return {
    ...s,
    /** Largo de las barras promedio / récord (el promedio es la referencia). */
    recordWidth: Math.max(6, Math.min(100, (s.fastest.days / Math.max(1, s.averageDays)) * 100)),
    lead: s.type
      ? `${v('te', 'le')} dura en promedio ${countType(s.type, 1)}.`
      : `${v('tardas', 'tarda')} en promedio en terminar algo.`,
    recordDays: s.fastest.days === 1 ? 'en un solo día' : `en ${s.fastest.days} días`,
  }
})

// --- Viaje en el tiempo ---
const timeTravel = computed(() => {
  const t = props.insights?.timeTravel
  if (!t) return null
  const [tu, el] = SEEN[t.type]
  return { ...t, seen: `${pronoun(t.type)} ${v(tu, el)}` }
})

// --- Constancia ---
const hasCollection = computed(() => props.dna.dominantType != null)
const completion = computed(() => props.dna.completionRate)
const completionDots = computed(() => Math.round(completion.value / 10))
const completionText = computed(() => {
  const r = completion.value
  if (r >= 90) return `${v('Terminas', 'Termina')} casi todo lo que ${v('empiezas', 'empieza')}.`
  if (r >= 60) return `${v('Terminas', 'Termina')} la mayoría de lo que ${v('empiezas', 'empieza')}.`
  if (r >= 40) return `${v('Completas', 'Completa')} ${r === 50 ? 'la' : 'cerca de la'} mitad de lo que ${v('empiezas', 'empieza')}.`
  return `${v('Dejas', 'Deja')} a medias buena parte de lo que ${v('empiezas', 'empieza')}.`
})

// --- Calificaciones (histograma de ½ a 5; índices 7–9 = 4, 4½ y 5) ---
const highRatings = computed(() => props.ratings.histogram.slice(7).reduce((a, b) => a + b, 0))
const ratingVerdict = computed(() => {
  const share = highRatings.value / props.ratings.count
  if (share >= 0.7) return `${v('Eres', 'Es')} de mano generosa.`
  if (share <= 0.3) return `${v('Eres', 'Es')} de estrellas difíciles.`
  return `${v('Repartes', 'Reparte')} las estrellas con equilibrio.`
})
const averageStars = computed(() => {
  const avg = props.ratings.average ?? 0
  return Array.from({ length: 5 }, (_, i) => (avg >= i + 1 ? 'star-fill' : avg >= i + 0.5 ? 'star-half' : 'star'))
})

// --- Día más intenso ---
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

// --- El banco: puntaje = qué tan llamativo es; se muestran los 3 mejores ---
type InsightKey = 'against' | 'speed' | 'timeTravel' | 'constancy' | 'ratings' | 'day'

const shown = computed<InsightKey[]>(() => {
  const candidates: { key: InsightKey; score: number }[] = []
  if (against.value) candidates.push({ key: 'against', score: 5 + Math.abs(against.value.gap) })
  if (speed.value) candidates.push({ key: 'speed', score: 3.5 })
  if (timeTravel.value) candidates.push({ key: 'timeTravel', score: 3 + timeTravel.value.years / 25 })
  if (hasCollection.value) {
    const extreme = completion.value >= 90 || completion.value <= 30
    candidates.push({ key: 'constancy', score: extreme ? 3 : 2 })
  }
  if (busiestDay.value) {
    candidates.push({ key: 'day', score: busiestDay.value.count >= 3 ? 2.5 : busiestDay.value.count === 2 ? 1.5 : 0.5 })
  }
  if (props.ratings.count) candidates.push({ key: 'ratings', score: props.ratings.count >= 3 ? 1.8 : 1 })
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => c.key)
})

const KICKERS: Record<InsightKey, string> = {
  against: 'Contra la corriente',
  speed: 'Velocidad',
  timeTravel: 'Viaje en el tiempo',
  constancy: 'Constancia',
  ratings: 'Calificaciones',
  day: 'día más intenso',
}
const kicker = (key: InsightKey) => (key === 'day' ? `${v('Tu', 'Su')} ${KICKERS.day}` : KICKERS[key])
</script>

<template>
  <template v-if="shown.length">
    <h3 class="insights__title">Insights</h3>
    <div class="insights">
      <article v-for="(key, i) in shown" :key="key" class="insight" :class="`insight--${i + 1}`">
        <h4 class="insight__kicker">{{ kicker(key) }}</h4>

        <!-- Contra la corriente -->
        <template v-if="key === 'against' && against">
          <div class="scale" aria-hidden="true">
            <span class="scale__track" />
            <span class="scale__mark scale__mark--theirs" :style="{ left: `${against.theirs}%` }" />
            <span class="scale__mark scale__mark--mine" :style="{ left: `${against.mine}%` }" />
          </div>
          <p class="legend" aria-hidden="true">
            <span><span class="legend__key legend__key--fill" /> {{ v('Tu nota', 'Su nota') }}</span>
            <span><span class="legend__key legend__key--ring" /> Mosaic</span>
          </p>
          <p class="insight__value">
            {{ against.gap > 0 ? '+' : '−' }}{{ decimal(Math.abs(against.gap)) }}<BaseIcon name="star-fill" class="insight__value-star" />
          </p>
          <p class="insight__text">
            {{ v('Le diste', 'Le dio') }} {{ decimal(against.rating) }}★ a <em>{{ against.title }}</em>; Mosaic le da
            {{ decimal(against.community) }}. {{ against.verdict }}
          </p>
        </template>

        <!-- Velocidad -->
        <template v-else-if="key === 'speed' && speed">
          <div class="bars" aria-hidden="true">
            <span class="bars__label">Promedio</span>
            <span class="bars__bar bars__bar--avg" />
            <span class="bars__label">Récord</span>
            <span class="bars__bar bars__bar--record" :style="{ width: `${speed.recordWidth}%` }" />
          </div>
          <p class="insight__value">{{ speed.averageDays }} {{ speed.averageDays === 1 ? 'día' : 'días' }}</p>
          <p class="insight__text">
            {{ speed.lead }} {{ v('Tu', 'Su') }} récord: <em>{{ speed.fastest.title }}</em>, {{ speed.recordDays }}.
          </p>
        </template>

        <!-- Viaje en el tiempo -->
        <template v-else-if="key === 'timeTravel' && timeTravel">
          <div class="years" aria-hidden="true">
            <span>{{ timeTravel.year }}</span>
            <span class="years__line" />
            <span>{{ timeTravel.seenYear }}</span>
          </div>
          <p class="insight__value">{{ timeTravel.years }} años</p>
          <p class="insight__text">
            separan <em>{{ timeTravel.title }}</em> ({{ timeTravel.year }}) del día en que {{ timeTravel.seen }}.
          </p>
        </template>

        <!-- Constancia -->
        <template v-else-if="key === 'constancy'">
          <div class="dots" aria-hidden="true">
            <span v-for="n in 10" :key="n" class="dots__dot" :class="{ 'is-on': n <= completionDots }" />
          </div>
          <p class="insight__value">{{ completion }}%</p>
          <p class="insight__text">
            {{ completionText }}
            <template v-if="lastAbandoned">Último abandono: <em>{{ lastAbandoned }}</em>.</template>
          </p>
        </template>

        <!-- Calificaciones -->
        <template v-else-if="key === 'ratings'">
          <div class="stars" aria-hidden="true">
            <BaseIcon v-for="(icon, s) in averageStars" :key="s" :name="icon" />
          </div>
          <p class="insight__value">{{ highRatings }} de {{ ratings.count }}</p>
          <p class="insight__text">
            de {{ v('tus', 'sus') }} notas son de 4★ o más. {{ ratingVerdict }}
          </p>
        </template>

        <!-- Día más intenso -->
        <template v-else-if="key === 'day' && busiestDay">
          <div class="calendar" aria-hidden="true">
            <span class="calendar__month">{{ busiestDay.month }}</span>
            <span class="calendar__day">{{ busiestDay.day }}</span>
          </div>
          <p class="insight__value">{{ busiestDay.count }} {{ busiestDay.count === 1 ? 'obra' : 'obras' }}</p>
          <p class="insight__text">
            {{ busiestDay.count === 1 ? 'ese día' : 'en un solo día' }}: {{ busiestDay.detail }}.
          </p>
        </template>
      </article>
    </div>
  </template>
</template>

<style scoped>
.insights__title {
  margin: var(--space-xs) 0 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}

.insights {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}

/*
 * Colores por posición. `--mark` / `--mark-muted` son los de los gráficos
 * chicos de cada tarjeta, para que se lean sobre fondo oscuro o claro.
 */
.insight {
  --mark: var(--color-accent-contrast);
  --mark-muted: color-mix(in srgb, var(--color-accent-contrast) 30%, transparent);
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  border-radius: var(--radius-md);
  color: var(--color-accent-contrast);
}

.insight--1 {
  --mark: var(--color-accent);
  --mark-muted: var(--color-text-subtle);
  background: color-mix(in srgb, var(--burnt-copper) 14%, var(--color-surface-2));
  color: var(--color-text);
}

.insight--2 {
  background: var(--color-accent);
}

.insight--3 {
  background: var(--rose);
}

.insight__kicker {
  margin: 0 0 var(--space-sm);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, currentColor 75%, transparent);
}

.insight--1 .insight__kicker {
  color: var(--color-accent);
}

.insight__value {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: auto 0 2px;
  padding-top: var(--space-sm);
  font-family: var(--font-sans);
  font-size: 1.625rem;
  font-weight: 800;
  line-height: 1.1;
}

.insight__value-star {
  font-size: 0.6em;
}

.insight__text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 0.75rem;
  line-height: 1.45;
}

/* --- Gráficos chicos --- */
.dots {
  display: grid;
  grid-template-columns: repeat(5, 11px);
  gap: 5px;
}

.dots__dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1.5px solid var(--mark-muted);
}

.dots__dot.is-on {
  border-color: var(--mark);
  background: var(--mark);
}

.stars {
  display: flex;
  gap: 4px;
  font-size: 0.9375rem;
  color: var(--mark);
}

.calendar {
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

.calendar__month {
  padding: 1px 0;
  background: var(--deep-raspberry);
  color: var(--fig-cream);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.calendar__day {
  padding: 1px 0 3px;
  color: var(--fig-purple);
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.1;
}

/* Escala de ½ a 5: punto lleno = su nota, anillo = Mosaic. */
.scale {
  position: relative;
  height: 14px;
  margin: 2px 7px;
}

.scale__track {
  position: absolute;
  inset: 6px 0 auto;
  height: 2px;
  border-radius: 999px;
  background: var(--mark-muted);
}

.scale__mark {
  position: absolute;
  top: 0;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border-radius: 50%;
}

.scale__mark--mine {
  background: var(--mark);
}

.scale__mark--theirs {
  border: 2px solid var(--mark);
}

/* Promedio (barra entera) vs. récord (proporcional), con su etiqueta a la izquierda. */
.bars {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 4px 8px;
}

.bars__label,
.legend {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, currentColor 70%, transparent);
}

.legend {
  display: flex;
  gap: var(--space-sm);
  margin: 4px 0 0;
}

.legend > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.legend__key {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend__key--fill {
  background: var(--mark);
}

.legend__key--ring {
  border: 1.5px solid var(--mark);
}

.bars__bar {
  height: 6px;
  border-radius: 999px;
}

.bars__bar--avg {
  width: 100%;
  background: var(--mark-muted);
}

.bars__bar--record {
  background: var(--mark);
}

/* Estreno → cuando la vio. */
.years {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--mark);
}

.years__line {
  flex: 1;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(to right, var(--mark-muted), var(--mark));
}

/* Escritorio: los tres en fila, con tamaños que siguen el ancho de la tarjeta. */
@container (min-width: 400px) {
  .insights {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(8px, 2cqi, 16px);
  }

  .insight {
    padding: clamp(8px, 1.9cqi, 12px);
  }

  .insight__kicker {
    font-size: clamp(0.5625rem, 1.6cqi, 0.6875rem);
    letter-spacing: 0.08em;
  }

  .insight__value {
    font-size: clamp(1.0625rem, 3.7cqi, 1.625rem);
  }

  .insight__text {
    font-size: clamp(0.625rem, 1.7cqi, 0.75rem);
  }

  .dots {
    grid-template-columns: repeat(5, clamp(8px, 1.8cqi, 11px));
    gap: clamp(3px, 0.8cqi, 5px);
  }

  .dots__dot {
    width: clamp(8px, 1.8cqi, 11px);
    height: clamp(8px, 1.8cqi, 11px);
  }
}
</style>
