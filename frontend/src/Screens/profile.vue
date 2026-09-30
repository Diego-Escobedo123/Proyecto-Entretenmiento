<script setup lang="ts">
/**
 * Perfil — retrato cultural del usuario ("¿quién soy?"): identidad, ADN,
 * obras esenciales, constancia, evolución, logros y listas públicas. Todo
 * derivado de datos reales (ver `useCulturalProfile`). El nombre/frase salen
 * del store de perfil y se editan desde Ajustes.
 *
 * El resumen del año vive aquí como historia a pantalla completa (estilo
 * Wrapped) y en el Diario como estadísticas; ambos salen de `yearStats`,
 * así que cuentan exactamente lo mismo.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import SectionHeader from '../components/SectionHeader.vue'
import BaseIcon from '../components/BaseIcon.vue'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'
import CulturalStory, { type StorySlide } from '../components/CulturalStory.vue'
import ListCard from '../components/lists/ListCard.vue'
import { MEDIA_TYPES } from '../lib/catalog'
import { goalProgress, yearStats } from '../lib/yearStats'
import { logService } from '../services/logService'
import { goalService } from '../services/goalService'
import { listService } from '../services/listService'
import { socialService } from '../services/socialService'
import type { Goal } from '../types/goal'
import type { ListSummary } from '../types/list'
import type { LogEntry } from '../types/log'
import { useMediaStore } from '../stores/media'
import { useProfileStore } from '../stores/profile'
import { useUiStore } from '../stores/ui'
import { useCulturalProfile } from '../composables/useCulturalProfile'

const media = useMediaStore()
const ui = useUiStore()
const { isEmpty, loading, entries } = storeToRefs(media)
const { profile } = storeToRefs(useProfileStore())

const currentYear = new Date().getFullYear()

// Diario, metas y listas: alimentan la constancia, la evolución, el año y las listas públicas.
const logs = ref<LogEntry[]>([])
const goals = ref<Goal[]>([])
const publicLists = ref<ListSummary[]>([])
/** Seguidores y seguidos (del perfil público propio). */
const follows = ref<{ followers: number; following: number } | null>(null)

onMounted(async () => {
  const [l, g, lists, me] = await Promise.allSettled([
    logService.list(),
    goalService.list(currentYear),
    listService.mine(),
    socialService.publicProfile('me'),
  ])
  if (l.status === 'fulfilled') logs.value = l.value
  if (g.status === 'fulfilled') goals.value = g.value
  if (lists.status === 'fulfilled') publicLists.value = lists.value.filter((x) => x.isPublic)
  if (me.status === 'fulfilled') follows.value = { followers: me.value.followers, following: me.value.following }
})

const {
  worksLogged,
  topGenres,
  dominantFormat,
  favoriteDecade,
  completionRate,
  identitySentence,
  essentialWorks,
  unlockedAchievements,
  nextAchievement,
  evolution,
  activityHeatmap,
} = useCulturalProfile(logs)

/** El año en curso, calculado igual que en Diario → Resumen del año. */
const year = computed(() => yearStats(logs.value, currentYear, entries.value))
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const storyOpen = ref(false)

// Si el heatmap no cabe, arranca mostrando los días más recientes (a la derecha).
const heatmapEl = ref<HTMLElement | null>(null)
watch(
  [heatmapEl, activityHeatmap],
  async () => {
    await nextTick()
    if (heatmapEl.value) heatmapEl.value.scrollLeft = heatmapEl.value.scrollWidth
  },
  { flush: 'post' },
)

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

const memberLabel = computed(() =>
  profile.value.memberSince ? `Desde ${profile.value.memberSince}` : 'Perfil recién creado',
)

// --- Donut de géneros (ADN cultural) ---
const genreColors = ['var(--color-accent)', 'var(--fig-stem-green)', 'var(--rose)']

const donutGradient = computed(() => {
  const genres = topGenres.value
  if (!genres.length) return 'conic-gradient(var(--color-border) 0% 100%)'
  let acc = 0
  const stops = genres.map((g, i) => {
    const start = acc
    acc += g.percent
    return `${genreColors[i % genreColors.length]} ${start}% ${acc}%`
  })
  if (acc < 100) stops.push(`var(--color-border) ${acc}% 100%`)
  return `conic-gradient(${stops.join(', ')})`
})
</script>

<template>
  <p v-if="loading && !media.loaded" class="profile__loading">Cargando tu perfil…</p>

  <EmptyState
    v-else-if="isEmpty"
    icon="person-circle"
    title="Tu perfil cultural se construye con tus obras"
    text="Todavía no hay datos que analizar. Registra algunas películas, libros, juegos o álbumes y aquí verás tus géneros, tu evolución y tus obras esenciales."
  >
    <BaseButton @click="ui.openCreateEntry()">Agregar una obra</BaseButton>
  </EmptyState>

  <template v-else>
    <section class="card profile-header">
      <div class="profile-header__avatar-ring">
        <img v-if="profile.avatar" :src="profile.avatar" :alt="profile.name" class="profile-header__avatar" />
        <div v-else class="profile-header__avatar profile-header__avatar--placeholder">
          {{ profile.name.charAt(0).toUpperCase() }}
        </div>
      </div>
      <h1 class="profile-header__name">{{ profile.name }}</h1>
      <p class="profile-header__tagline">{{ profile.tagline }}</p>
      <p v-if="profile.quote" class="profile-header__quote">&ldquo;{{ profile.quote }}&rdquo;</p>
      <p class="profile-header__meta">
        <span>{{ memberLabel }}</span>
        <span class="profile-header__dot">•</span>
        <span>{{ worksLogged }} obras registradas</span>
        <template v-if="follows">
          <span class="profile-header__dot">•</span>
          <RouterLink to="/users/me/followers" class="profile-header__follows">
            <strong>{{ follows.followers }}</strong> {{ follows.followers === 1 ? 'seguidor' : 'seguidores' }}
          </RouterLink>
          <span class="profile-header__dot">•</span>
          <RouterLink to="/users/me/following" class="profile-header__follows">
            <strong>{{ follows.following }}</strong> {{ follows.following === 1 ? 'seguido' : 'seguidos' }}
          </RouterLink>
        </template>
      </p>
      <div class="profile-header__actions">
        <BaseButton variant="outline" @click="ui.openSettings()">Editar perfil</BaseButton>
        <RouterLink to="/users/me" class="profile-header__public-link">
          <BaseIcon name="eye" /> Ver como lo ven los demás
        </RouterLink>
      </div>
    </section>

    <section class="card">
      <h2 class="card__title">Tu identidad cultural</h2>
      <p class="identity__text">{{ identitySentence }}</p>
    </section>

    <section class="two-col">
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
          <p v-else class="dna__value">Aún sin géneros: agrégalos al registrar obras.</p>

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
              <p class="dna__value">{{ dominantFormat ? dominantFormat.plural : 'Sin datos suficientes' }}</p>
            </div>
          </div>

          <p class="dna__insight">
            <strong>Insight:</strong> completas el {{ completionRate }}% de las obras que empiezas.
          </p>
        </div>
      </div>

      <div class="card wrapup">
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
    </section>

    <section v-if="essentialWorks.length">
      <SectionHeader title="Las obras que te definen" link-text="Tus esenciales" />
      <div class="works-grid">
        <article v-for="work in essentialWorks" :key="work.id" class="work-card">
          <img v-if="work.cover" :src="work.cover" :alt="work.title" class="work-card__cover" />
          <div v-else class="work-card__cover work-card__cover--placeholder" />
          <h3 class="work-card__title">{{ work.title }}</h3>
          <p class="work-card__subtitle">{{ work.subtitle }}</p>
        </article>
      </div>
    </section>

    <section class="two-col">
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">Constancia</h2>
          <span class="card__header-label">Últimos 365 días</span>
        </div>
        <div class="heatmap">
          <div ref="heatmapEl" class="heatmap__grid">
            <span
              v-for="day in activityHeatmap"
              :key="day.date"
              class="heatmap__cell"
              :class="`heatmap__cell--${day.level}`"
              :title="`${day.count} ${day.count === 1 ? 'registro' : 'registros'} en tu diario · ${day.label}`"
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

      <div class="card">
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
    </section>

    <CulturalStory v-if="storyOpen" :slides="storySlides" @close="storyOpen = false" />

    <section>
      <div class="card">
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
    </section>

    <section v-if="publicLists.length">
      <SectionHeader title="Tus listas públicas" />
      <div class="profile-lists">
        <ListCard v-for="l in publicLists" :key="l.id" :list="l" />
      </div>
    </section>
  </template>
</template>

<style scoped>
.profile__loading {
  color: var(--color-text-muted);
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

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-sm);
  padding: var(--space-xl);
}

.profile-header__avatar-ring {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  padding: 4px;
  background: radial-gradient(circle at 50% 40%, var(--color-accent-bg), transparent 70%);
  box-shadow: 0 0 0 1px var(--color-border), 0 0 24px var(--color-accent-bg);
  margin-bottom: var(--space-sm);
}

.profile-header__avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: linear-gradient(135deg, var(--color-surface-2), var(--color-surface));
}

.profile-header__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--color-accent);
}

.profile-header__name {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0;
}

.profile-header__tagline {
  color: var(--color-accent);
  font-size: 1.0625rem;
  font-weight: 700;
  margin: 0;
}

.profile-header__quote {
  color: var(--color-text-muted);
  font-style: italic;
  margin: var(--space-sm) 0 0 0;
}

.profile-header__meta {
  color: var(--color-text-subtle);
  font-size: 0.875rem;
  margin: var(--space-md) 0 var(--space-md) 0;
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  justify-content: center;
}

.identity__text {
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
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

.profile-header__follows {
  color: inherit;
}

.profile-header__follows strong {
  color: var(--color-text);
}

.profile-header__follows:hover {
  color: var(--color-accent);
}

.profile-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
}

.profile-header__public-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-accent);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
}

.profile-header__public-link:hover {
  text-decoration: underline;
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

.works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-md);
}

.work-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.work-card__cover {
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-lg);
  object-fit: cover;
  border: 1px solid var(--color-border);
  margin-bottom: var(--space-xs);
}

.work-card__cover--placeholder {
  background: linear-gradient(135deg, var(--color-surface-2), var(--color-surface));
}

.work-card__title {
  color: var(--color-text);
  font-size: 0.9375rem;
  font-weight: 700;
  margin: 0;
}

.work-card__subtitle {
  color: var(--color-accent);
  font-size: 0.8125rem;
  margin: 0;
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

.profile-lists {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
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
  .two-col {
    grid-template-columns: 1fr;
  }
}
</style>
