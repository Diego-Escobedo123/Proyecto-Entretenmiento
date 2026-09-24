<script setup lang="ts">
/**
 * Perfil — retrato cultural del usuario, TODO derivado de sus obras reales
 * (ver `useCulturalProfile`). El nombre/frase salen del store de perfil y se
 * editan desde Ajustes.
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import SectionHeader from '../components/SectionHeader.vue'
import StatCard from '../components/StatCard.vue'
import BaseIcon from '../components/BaseIcon.vue'
import RatingStars from '../components/RatingStars.vue'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'
import CulturalStory, { type StorySlide } from '../components/CulturalStory.vue'
import { useMediaStore } from '../stores/media'
import { useProfileStore } from '../stores/profile'
import { useUiStore } from '../stores/ui'
import { useCulturalProfile } from '../composables/useCulturalProfile'

const media = useMediaStore()
const ui = useUiStore()
const { isEmpty, loading } = storeToRefs(media)
const { profile } = storeToRefs(useProfileStore())

const {
  worksLogged,
  statsByType,
  topGenres,
  dominantFormat,
  favoriteDecade,
  completionRate,
  identitySentence,
  diary,
  essentialWorks,
  unlockedAchievements,
  nextAchievement,
  evolution,
  activityHeatmap,
} = useCulturalProfile()

const currentYear = new Date().getFullYear()
const storyOpen = ref(false)

// --- Historia cultural estilo "Wrapped" (a partir de los mismos datos reales) ---
const storySlides = computed<StorySlide[]>(() => {
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
    caption: 'Así fue tu año cultural en Mosaic.',
    background: g1,
  })

  slides.push({
    eyebrow: 'En total',
    value: String(worksLogged.value),
    title: worksLogged.value === 1 ? 'obra registrada' : 'obras registradas',
    caption: 'Cada una suma a tu mosaico cultural.',
    background: g2,
  })

  if (topGenres.value[0]) {
    slides.push({
      eyebrow: 'Tu género favorito',
      value: `${topGenres.value[0].percent}%`,
      title: topGenres.value[0].name,
      caption: 'Fue el género que más se repitió en lo que registraste.',
      background: g3,
    })
  }

  if (dominantFormat.value) {
    const count = statsByType.value.find((s) => s.label === dominantFormat.value?.plural)?.value ?? 0
    slides.push({
      eyebrow: 'Tu formato dominante',
      value: String(count),
      title: dominantFormat.value.plural.toLowerCase(),
      caption: 'Es donde pasaste la mayor parte de tu tiempo cultural.',
      background: g4,
    })
  }

  if (favoriteDecade.value) {
    slides.push({
      eyebrow: 'Tu década favorita',
      value: `${favoriteDecade.value.decade}s`,
      title: `${favoriteDecade.value.percent}% de tus obras con año`,
      caption: 'El pasado al que más volviste.',
      background: g5,
    })
  }

  slides.push({
    eyebrow: 'Constancia',
    value: `${completionRate.value}%`,
    title: 'de finalización',
    caption: 'De las obras que empezaste, este porcentaje las completaste.',
    background: g1,
  })

  if (unlockedAchievements.value.length) {
    slides.push({
      eyebrow: 'Logros',
      value: String(unlockedAchievements.value.length),
      title: unlockedAchievements.value.length === 1 ? 'logro desbloqueado' : 'logros desbloqueados',
      caption: 'Sigue registrando obras para desbloquear más.',
      background: g4,
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

    <section class="stats-grid">
      <StatCard
        v-for="stat in statsByType"
        :key="stat.label"
        :icon="stat.icon"
        :value="stat.value"
        :label="stat.label"
        :delta="stat.delta"
      />
    </section>

    <section class="two-col">
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">Diario cultural</h2>
          <span class="card__header-label">Tus últimas obras</span>
        </div>
        <ul class="diary">
          <li v-for="entry in diary" :key="entry.id" class="diary__entry">
            <span class="diary__marker" :class="{ 'diary__marker--current': entry.current }" />
            <div class="diary__body">
              <p class="diary__date">{{ entry.date }}</p>
              <h3 class="diary__title">{{ entry.title }}</h3>
              <span class="diary__tag">{{ entry.typeLabel }}</span>
              <p v-if="entry.review" class="diary__review">{{ entry.review }}</p>
              <p class="diary__quote">
                <span
                  v-if="entry.noteVisibility"
                  class="diary__visibility"
                  :title="entry.noteVisibility === 'public' ? 'Nota pública: visible en tu perfil' : 'Nota privada: sólo tú la ves'"
                >
                  <BaseIcon :name="entry.noteVisibility === 'public' ? 'globe2' : 'lock-fill'" />
                </span>
                {{ entry.note }}
              </p>
            </div>
            <RatingStars v-if="entry.rating != null" :value="entry.rating" />
          </li>
        </ul>
      </div>

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
          <h2 class="card__title">Diario Cultural</h2>
          <span class="card__header-label">Últimos 365 días</span>
        </div>
        <div class="heatmap">
          <div class="heatmap__grid">
            <span
              v-for="day in activityHeatmap"
              :key="day.date"
              class="heatmap__cell"
              :class="`heatmap__cell--${day.level}`"
              :title="`${day.count} obra(s) · ${day.label}`"
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

      <div class="card wrapup">
        <span class="wrapup__eyebrow">Tu {{ currentYear }}</span>
        <h2 class="wrapup__title">Resumen Cultural</h2>
        <button class="wrapup__cta" type="button" @click="storyOpen = true">
          <BaseIcon name="play-circle-fill" />
          Ver tu historia
        </button>
        <p class="wrapup__hint">Descubre cómo evolucionaron tus gustos este año.</p>
      </div>
    </section>

    <CulturalStory v-if="storyOpen" :slides="storySlides" @close="storyOpen = false" />

    <section class="two-col">
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">Evolución</h2>
          <span class="card__header-label">Últimos 12 meses</span>
        </div>
        <p class="evolution__summary">
          <template v-if="evolution.trendPercent != null && evolution.trendPercent > 0">
            Registraste un {{ evolution.trendPercent }}% más que el semestre anterior.
          </template>
          <template v-else-if="evolution.trendPercent != null && evolution.trendPercent < 0">
            Bajaste el ritmo un {{ Math.abs(evolution.trendPercent) }}% frente al semestre anterior.
          </template>
          <template v-else>
            {{ evolution.total }} obras registradas en el último año.
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
}

.two-col {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-md);
  align-items: start;
}

.diary {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  position: relative;
}

.diary::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 6px;
  bottom: 6px;
  width: 1px;
  background: var(--color-border);
}

.diary__entry {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  position: relative;
  padding-left: var(--space-lg);
}

.diary__marker {
  position: absolute;
  left: 0;
  top: 6px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-surface-2);
  border: 2px solid var(--color-text-subtle);
}

.diary__marker--current {
  border-color: var(--color-accent);
  background: var(--color-accent);
  box-shadow: 0 0 0 4px var(--color-accent-bg);
}

.diary__body {
  flex: 1;
  min-width: 0;
}

.diary__date {
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-xs) 0;
}

.diary__title {
  color: var(--color-text);
  font-size: 1.0625rem;
  font-weight: 700;
  margin: 0;
}

.diary__quote {
  color: var(--color-text-muted);
  font-style: italic;
  margin: var(--space-xs) 0 0 0;
}

.diary__review {
  color: var(--color-text);
  font-size: 0.875rem;
  margin: var(--space-xs) 0 0 0;
}

.diary__visibility {
  font-style: normal;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  margin-right: 4px;
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

.diary__tag {
  display: inline-block;
  margin-top: var(--space-xs);
  padding: 2px var(--space-sm);
  border-radius: 999px;
  background: var(--color-surface-2);
  color: var(--color-text-subtle);
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
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
