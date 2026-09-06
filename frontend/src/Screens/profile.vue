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
import RatingStars from '../components/RatingStars.vue'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'
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
} = useCulturalProfile()

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
</script>

<template>
  <p v-if="loading && !media.loaded" class="profile__loading">Cargando tu perfil…</p>

  <EmptyState
    v-else-if="isEmpty"
    icon="👤"
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
      <BaseButton variant="outline" @click="ui.openSettings()">Editar perfil</BaseButton>
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
              <p class="diary__quote">{{ entry.note }}</p>
            </div>
            <RatingStars v-if="entry.rating != null" :value="entry.rating" />
          </li>
        </ul>
      </div>

      <div class="card">
        <div class="card__header">
          <h2 class="card__title">ADN cultural</h2>
          <span class="card__header-label" aria-hidden="true">🧬</span>
        </div>
        <div class="dna">
          <div class="dna__field">
            <h4 class="dna__label">Géneros principales</h4>
            <p v-if="topGenres.length" class="dna__value">
              {{ topGenres.map((g) => `${g.name} (${g.percent}%)`).join(', ') }}
            </p>
            <p v-else class="dna__value">Aún sin géneros: agrégalos al registrar obras.</p>
          </div>
          <div class="dna__field">
            <h4 class="dna__label">Década favorita</h4>
            <p class="dna__value">
              <template v-if="favoriteDecade">
                Los {{ favoriteDecade.decade }}s — {{ favoriteDecade.percent }}% de tus obras con año.
              </template>
              <template v-else>Indica el año de tus obras para ver esta stat.</template>
            </p>
          </div>
          <div class="dna__field">
            <h4 class="dna__label">Formato dominante</h4>
            <p class="dna__value">
              {{ dominantFormat ? dominantFormat.plural : 'Sin datos suficientes' }}
            </p>
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
        <h2 class="card__title"><span aria-hidden="true">🏆</span> Logros</h2>
        <ul class="achievements">
          <li v-for="a in unlockedAchievements" :key="a.label">
            <span class="achievements__check" aria-hidden="true">✓</span>
            {{ a.label }}
          </li>
          <li v-if="nextAchievement" class="achievements__next">
            <span class="achievements__check achievements__check--locked" aria-hidden="true">○</span>
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

.dna {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
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
