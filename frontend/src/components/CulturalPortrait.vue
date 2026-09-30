<script setup lang="ts">
/**
 * CulturalPortrait — "Tu retrato cultural", la parte del perfil que sólo ve
 * su dueño: ADN (géneros, década, formato), resumen del año como historia
 * estilo Wrapped, constancia, logros y evolución. Se calcula con toda la
 * colección y el diario del usuario actual (ver `useCulturalProfile`), por
 * eso no se muestra en perfiles ajenos.
 *
 * El resumen del año sale de `yearStats`, igual que en Diario → Resumen del
 * año, así que ambos cuentan exactamente lo mismo.
 *
 * `hideShared`: con perfil público, ADN y Constancia ya se muestran en la
 * parte visible para todos, así que aquí se omiten.
 *
 * Uso:
 *   <CulturalPortrait :hide-shared="perfil.isPublic" />
 */
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from './BaseIcon.vue'
import CulturalStory, { type StorySlide } from './CulturalStory.vue'
import DnaCard from './profile/DnaCard.vue'
import ConstancyCard from './profile/ConstancyCard.vue'
import { MEDIA_TYPES } from '../lib/catalog'
import { goalProgress, yearStats } from '../lib/yearStats'
import { logService } from '../services/logService'
import { goalService } from '../services/goalService'
import type { Goal } from '../types/goal'
import type { LogEntry } from '../types/log'
import { useMediaStore } from '../stores/media'
import { useProfileStore } from '../stores/profile'
import { useCulturalProfile } from '../composables/useCulturalProfile'

withDefaults(defineProps<{ hideShared?: boolean }>(), { hideShared: false })

const { entries } = storeToRefs(useMediaStore())
const { profile } = storeToRefs(useProfileStore())

const currentYear = new Date().getFullYear()

// Diario y metas: alimentan la constancia, la evolución y el resumen del año.
const logs = ref<LogEntry[]>([])
const goals = ref<Goal[]>([])

onMounted(async () => {
  const [l, g] = await Promise.allSettled([logService.list(), goalService.list(currentYear)])
  if (l.status === 'fulfilled') logs.value = l.value
  if (g.status === 'fulfilled') goals.value = g.value
})

const {
  topGenres,
  dominantFormat,
  favoriteDecade,
  completionRate,
  identitySentence,
  unlockedAchievements,
  nextAchievement,
  evolution,
} = useCulturalProfile(logs)

/** Días en que empezó o terminó algo, para Constancia. */
const activityDays = computed(() =>
  logs.value.flatMap((l) => [l.startedAt, l.finishedAt].filter((d): d is string => Boolean(d))),
)

/** El año en curso, calculado igual que en Diario → Resumen del año. */
const year = computed(() => yearStats(logs.value, currentYear, entries.value))
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const storyOpen = ref(false)

// --- Historia cultural estilo "Wrapped": el año en curso, desde el diario ---
const storySlides = computed<StorySlide[]>(() => {
  const s = year.value
  const slides: StorySlide[] = []
  const g1 = 'linear-gradient(135deg, var(--fig-purple), var(--deep-raspberry))'
  const g2 = 'linear-gradient(135deg, var(--deep-raspberry), var(--burnt-copper))'
  const g3 = 'linear-gradient(135deg, var(--fig-purple), var(--fig-stem-green))'
  const g4 = 'linear-gradient(135deg, var(--burnt-copper), var(--fig-purple))'
  const g5 = 'linear-gradient(135deg, var(--fig-stem-green), var(--fig-purple))'
  const g6 = 'linear-gradient(135deg, var(--deep-raspberry), var(--fig-purple))'

  slides.push({
    eyebrow: `Tu ${currentYear}`,
    title: `Hola, ${profile.value.name.split(' ')[0] || profile.value.name}`,
    caption: 'Así va tu año cultural en Mosaic.',
    background: g1,
  })

  if (!s.total) {
    slides.push({
      eyebrow: 'Por ahora',
      title: `Aún no terminas nada en ${currentYear}`,
      caption: 'Cuando termines algo quedará en tu diario, y tu historia se armará sola.',
      background: g2,
    })
    return slides
  }

  slides.push({
    eyebrow: 'En total',
    value: String(s.total),
    title: s.total === 1 ? 'obra terminada este año' : 'obras terminadas este año',
    caption: 'Cada una suma a tu mosaico cultural.',
    background: g2,
  })

  const dominant = MEDIA_TYPES.map((t) => ({ t, n: s.byType[t.value] })).sort((a, b) => b.n - a.n)[0]
  if (dominant?.n) {
    slides.push({
      eyebrow: 'Tu formato del año',
      value: String(dominant.n),
      title: dominant.t.plural.toLowerCase(),
      caption: 'Es donde pasaste la mayor parte de tu tiempo cultural.',
      background: g4,
    })
  }

  const genre = s.topGenres[0]
  if (genre) {
    slides.push({
      eyebrow: 'Tu género del año',
      value: String(genre.count),
      title: genre.name,
      caption: genre.count === 1 ? 'obra de este género.' : 'obras de este género, más que cualquier otro.',
      background: g3,
    })
  }

  const peak = s.perMonth.indexOf(Math.max(...s.perMonth))
  if (s.perMonth[peak] > 1) {
    slides.push({
      eyebrow: 'Tu mes más intenso',
      value: String(s.perMonth[peak]),
      title: `en ${MONTH_NAMES[peak]}`,
      caption: 'El mes en que más obras terminaste.',
      background: g5,
    })
  }

  if (s.pages || s.hours) {
    const pages = s.pages ? `${s.pages.toLocaleString('es')} páginas` : ''
    const hours = s.hours ? `${s.hours.toLocaleString('es', { maximumFractionDigits: 1 })} horas de juego` : ''
    slides.push({
      eyebrow: 'Tiempo invertido',
      value: pages ? s.pages.toLocaleString('es') : s.hours.toLocaleString('es', { maximumFractionDigits: 1 }),
      title: pages ? 'páginas leídas' : 'horas jugadas',
      caption: pages && hours ? `Y además, ${hours}.` : 'Y valió cada minuto.',
      background: g6,
    })
  }

  const best = s.topRated[0]
  if (best) {
    slides.push({
      eyebrow: 'Tu favorita del año',
      image: best.log.entry?.cover ?? undefined,
      title: best.log.entry?.title ?? '',
      caption: `La calificaste con ${best.rating.toLocaleString('es')} de 5 estrellas.`,
      background: g1,
    })
  }

  const goal = goals.value.find((g) => g.type === 'all') ?? goals.value[0]
  if (goal) {
    const done = goalProgress(logs.value, currentYear, goal.type)
    slides.push({
      eyebrow: `Reto ${currentYear}`,
      value: `${done}/${goal.target}`,
      title: done >= goal.target ? '¡Meta cumplida!' : `Vas por el ${Math.round((done / goal.target) * 100)}%`,
      caption: done >= goal.target ? 'Te pusiste una meta y la cumpliste.' : 'Todavía queda año para lograrlo.',
      background: g4,
    })
  }

  if (s.repeats) {
    slides.push({
      eyebrow: 'Lo que no pudiste soltar',
      value: String(s.repeats),
      title: s.repeats === 1 ? 'vez que volviste a algo' : 'veces que volviste a algo',
      caption: 'Algunas obras merecen otra vuelta.',
      background: g3,
    })
  }

  slides.push({
    eyebrow: `Mosaic · ${currentYear}`,
    title: identitySentence.value || 'Gracias por construir tu mosaico cultural.',
    caption: 'Vuelve pronto a ver cómo evoluciona.',
    background: g6,
  })

  return slides
})

// --- Mini area chart (serie única, sin librería) ---
const chartWidth = 700
const chartHeight = 200
const padY = 12

const points = computed(() => {
  const values = evolution.value.values
  const max = Math.max(1, ...values)
  return values.map((v, i) => ({
    x: (i / Math.max(1, values.length - 1)) * chartWidth,
    y: chartHeight - padY - (v / max) * (chartHeight - padY * 2),
    month: evolution.value.months[i],
    value: v,
  }))
})

function smoothLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

const linePath = computed(() => smoothLinePath(points.value))
const areaPath = computed(() => `${linePath.value} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`)

const hoverIndex = ref<number | null>(null)
const chartEl = ref<HTMLElement | null>(null)

function onChartMove(event: MouseEvent) {
  if (!chartEl.value) return
  const rect = chartEl.value.getBoundingClientRect()
  const ratio = (event.clientX - rect.left) / rect.width
  const count = evolution.value.values.length
  hoverIndex.value = Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))))
}

const hoverPoint = computed(() =>
  hoverIndex.value !== null ? points.value[hoverIndex.value] ?? null : null,
)

</script>

<template>
  <section class="portrait">
    <header class="portrait__head">
      <h2 class="portrait__title"><BaseIcon name="stars" /> Tu retrato cultural</h2>
      <span class="portrait__private"><BaseIcon name="lock-fill" /> Sólo lo ves tú</span>
    </header>
    <p v-if="identitySentence" class="portrait__identity">{{ identitySentence }}</p>

    <div class="portrait__grid" :class="{ 'portrait__grid--even': hideShared }">
      <DnaCard
        v-if="!hideShared"
        class="portrait__dna"
        :top-genres="topGenres"
        :favorite-decade="favoriteDecade"
        :dominant-label="dominantFormat?.plural ?? null"
        :completion-rate="completionRate"
        self
      />
      <div class="card wrapup portrait__wrap">
        <span class="wrapup__eyebrow">Tu {{ currentYear }}</span>
        <h2 class="wrapup__title">Resumen del año</h2>
        <p v-if="year.total" class="wrapup__stat">
          <strong>{{ year.total }}</strong> {{ year.total === 1 ? 'obra terminada' : 'obras terminadas' }}
          <template v-if="year.topGenres[0]"> · sobre todo {{ year.topGenres[0].name }}</template>
        </p>
        <p v-else class="wrapup__hint">Aún no terminas nada este año.</p>
        <button class="wrapup__cta" type="button" @click="storyOpen = true">
          <BaseIcon name="play-circle-fill" />
          Ver tu historia
        </button>
        <RouterLink to="/diary?tab=review" class="wrapup__link">
          Ver en números <BaseIcon name="arrow-right" />
        </RouterLink>
      </div>
      <ConstancyCard v-if="!hideShared" class="portrait__constancy" :days="activityDays" self />
      <div class="card portrait__logros">
        <h2 class="card__title"><BaseIcon name="trophy" /> Logros</h2>
        <ul class="achievements">
          <li v-for="a in unlockedAchievements" :key="a.label">
            <span class="achievements__check"><BaseIcon name="check-lg" /></span>
            {{ a.label }}
          </li>
          <li v-if="nextAchievement" class="achievements__next">
            <span class="achievements__check achievements__check--locked"><BaseIcon name="circle" /></span>
            Próximo: {{ nextAchievement.label }}
          </li>
        </ul>
      </div>
      <div class="card portrait__evo">
        <div class="card__header">
          <h2 class="card__title">Evolución</h2>
          <span class="card__header-label">Últimos 12 meses</span>
        </div>
        <p class="evolution__summary">
          <template v-if="evolution.trendPercent != null && evolution.trendPercent > 0">
            Terminaste un {{ evolution.trendPercent }}% más que el semestre anterior.
          </template>
          <template v-else-if="evolution.trendPercent != null && evolution.trendPercent < 0">
            Bajaste el ritmo un {{ Math.abs(evolution.trendPercent) }}% frente al semestre anterior.
          </template>
          <template v-else>
            {{ evolution.total }} {{ evolution.total === 1 ? 'obra terminada' : 'obras terminadas' }} en el último año.
          </template>
        </p>

        <div ref="chartEl" class="evolution__chart" @mousemove="onChartMove" @mouseleave="hoverIndex = null">
          <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" preserveAspectRatio="none" class="evolution__svg">
            <defs>
              <linearGradient id="evolution-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.25" />
                <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" :y1="chartHeight - 1" :x2="chartWidth" :y2="chartHeight - 1" class="evolution__baseline" />
            <path :d="areaPath" fill="url(#evolution-fill)" stroke="none" />
            <path :d="linePath" fill="none" class="evolution__line" />
            <g v-if="hoverPoint">
              <line :x1="hoverPoint.x" y1="0" :x2="hoverPoint.x" :y2="chartHeight" class="evolution__crosshair" />
              <circle :cx="hoverPoint.x" :cy="hoverPoint.y" r="5" class="evolution__dot" />
            </g>
          </svg>
          <div
            v-if="hoverPoint"
            class="evolution__tooltip"
            :style="{ left: (hoverPoint.x / chartWidth) * 100 + '%', top: hoverPoint.y + 'px' }"
          >
            <strong>{{ hoverPoint.value }}</strong>
            <span>{{ hoverPoint.month }}</span>
          </div>
        </div>

        <div class="evolution__months">
          <span v-for="(m, i) in evolution.months" :key="i" v-show="i % 3 === 0">{{ m }}</span>
        </div>
      </div>
    </div>

    <CulturalStory v-if="storyOpen" :slides="storySlides" @close="storyOpen = false" />

  </section>
</template>

<style scoped>
.portrait {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.portrait__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.portrait__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-text);
}

.portrait__private {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

/*
 * Filas de dos tarjetas iguales (misma altura) y Constancia a todo lo ancho:
 *   ADN | Resumen del año  /  Constancia  /  Logros | Evolución
 * Sin ADN ni Constancia (ya se ven arriba, perfil público):
 *   Resumen del año | Logros  /  Evolución
 */
.portrait__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-areas:
    'dna wrap'
    'constancy constancy'
    'logros evo';
  gap: var(--space-md);
  align-items: stretch;
}

.portrait__grid--even {
  grid-template-areas:
    'wrap logros'
    'evo evo';
}

.portrait__grid > * {
  min-width: 0;
}

.portrait__dna {
  grid-area: dna;
}

.portrait__wrap {
  grid-area: wrap;
}

.portrait__constancy {
  grid-area: constancy;
}

.portrait__logros {
  grid-area: logros;
}

.portrait__evo {
  grid-area: evo;
}

.portrait__identity {
  margin: 0;
  font-size: 1.0625rem;
  line-height: 1.6;
  color: var(--color-text);
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.card__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 var(--space-md) 0;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.card__header .card__title {
  margin: 0;
}

.card__header-label {
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
  font-weight: 600;
}










.two-col {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-md);
  align-items: start;
}

/* Sin esto el heatmap (ancho fijo) ensancha su columna y empuja la otra fuera de la página. */
.two-col > * {
  min-width: 0;
}







.wrapup {
  align-self: stretch;
  background: linear-gradient(135deg, var(--deep-raspberry), var(--fig-purple));
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-sm);
}

.wrapup__eyebrow {
  color: var(--rose);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.wrapup__title {
  color: var(--fig-cream);
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
}

.wrapup__cta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  background: rgba(243, 231, 216, 0.12);
  border: 1px solid rgba(243, 231, 216, 0.24);
  border-radius: 999px;
  color: var(--fig-cream);
  font-weight: 700;
  font-size: 0.875rem;
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  transition: background 0.15s ease;
}

.wrapup__cta:hover {
  background: rgba(243, 231, 216, 0.2);
}

.wrapup__stat {
  margin: 0;
  color: var(--fig-cream);
  font-size: 0.9375rem;
}

.wrapup__stat strong {
  font-size: 1.5rem;
  color: var(--color-accent);
}

.wrapup__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--rose);
  font-size: 0.875rem;
  font-weight: 600;
}

.wrapup__link:hover {
  color: var(--fig-cream);
}


.wrapup__hint {
  color: var(--rose);
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0;
}

.evolution__summary {
  color: var(--color-text);
  font-weight: 600;
  margin: 0;
}

.evolution__chart {
  position: relative;
  margin-top: var(--space-lg);
  height: 200px;
}

.evolution__svg {
  width: 100%;
  height: 200px;
  display: block;
  overflow: visible;
}

.evolution__baseline {
  stroke: var(--color-border);
  stroke-width: 1;
}

.evolution__line {
  stroke: var(--color-accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.evolution__crosshair {
  stroke: var(--color-border);
  stroke-width: 1;
}

.evolution__dot {
  fill: var(--color-accent);
  stroke: var(--color-surface);
  stroke-width: 2;
}

.evolution__tooltip {
  position: absolute;
  transform: translate(-50%, -130%);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-sm);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
  white-space: nowrap;
}

.evolution__tooltip strong {
  color: var(--color-text);
  font-size: 0.875rem;
}

.evolution__months {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-sm);
  color: var(--color-text-subtle);
  font-size: 0.75rem;
}

.achievements {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.achievements li {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.achievements__check {
  color: var(--color-success);
  font-weight: 700;
}

.achievements__check--locked {
  color: var(--color-text-subtle);
}

.achievements__next {
  color: var(--color-text-subtle) !important;
}

@media (max-width: 900px) {
  .two-col,
  .portrait__grid {
    grid-template-columns: 1fr;
  }

  .portrait__grid {
    grid-template-areas: 'dna' 'wrap' 'constancy' 'logros' 'evo';
  }

  .portrait__grid--even {
    grid-template-areas: 'wrap' 'logros' 'evo';
  }
}
</style>
