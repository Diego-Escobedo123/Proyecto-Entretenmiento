<script setup lang="ts">
/**
 * DnaOverview — "ADN cultural" completo del perfil público: dona de géneros,
 * década favorita sobre una línea de tiempo, formato dominante con el resto
 * de los tipos, y los insights (ver ProfileInsights). `self` pasa los textos
 * a segunda persona.
 * Se adapta al ancho de su tarjeta (container queries), no al de la ventana.
 *
 * Uso:
 *   <DnaOverview :dna="profile.dna" :ratings="profile.ratings" :activity="profile.activity"
 *                :last-abandoned="profile.lastAbandoned" :insights="profile.insights" self />
 */
import { computed } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import ProfileInsights from './ProfileInsights.vue'
import { typeMeta } from '../../lib/catalog'
import { GENRE_COLORS, OTHER_GENRES_COLOR, OTHER_GENRES_LABEL } from '../../lib/genreColors'
import type { ActivityEvent, ProfileInsightsData, PublicProfile } from '../../types/review'

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

        <!-- Década y formato: juntas, del alto de su contenido (no del de la dona) -->
        <div class="ov__facts">
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
      </div>

      <ProfileInsights
        :dna="dna"
        :ratings="ratings"
        :activity="activity"
        :last-abandoned="lastAbandoned"
        :insights="insights"
        :self="self"
      />
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
 * (los insights en fila los acomoda ProfileInsights); tamaños y rellenos se
 * escalan con el ancho de la tarjeta (cqi) para que quepa igual a 1280px que a 1920px.
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

/* Década y formato: una columna en teléfono, lado a lado en escritorio. */
.ov__facts {
  display: grid;
  gap: var(--space-md);
}

@container (min-width: 400px) {
  .ov__top {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    align-items: start;
    gap: clamp(8px, 2cqi, 16px);
  }

  .ov__facts {
    grid-template-columns: 1fr 1fr;
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
  width: min(130px, 100%);
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
  font-size: 1.375rem;
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
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-2) 60%, var(--color-surface));
}

.ov__kicker {
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
  font-size: 1.375rem;
  font-weight: 900;
  line-height: 1.1;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.ov__big--accent {
  font-size: 2.25rem;
  color: var(--color-accent);
}

.ov__caption {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.ov__type-icon {
  font-size: 1.75rem;
  color: var(--color-accent);
  line-height: 1;
  margin-bottom: var(--space-xs);
}

.ov__types {
  list-style: none;
  margin: auto 0 0;
  padding: var(--space-xs) 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 2px var(--space-md);
  font-size: 0.75rem;
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
  padding: var(--space-sm) 0 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  position: relative;
}

.timeline::before {
  content: '';
  position: absolute;
  top: calc(var(--space-sm) + 7px);
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

/* Escritorio: al final para ganarle a las reglas base (misma especificidad). */
@container (min-width: 400px) {

  .ov__fact {
    padding: clamp(8px, 1.9cqi, 12px);
  }

  .ov__big {
    font-size: clamp(1rem, 3.2cqi, 1.375rem);
  }

  .ov__big--accent {
    font-size: clamp(1.5rem, 5cqi, 2.25rem);
  }

  .ov__caption {
    font-size: clamp(0.625rem, 1.7cqi, 0.75rem);
  }

  .ov__type-icon {
    font-size: clamp(1.25rem, 3.8cqi, 1.75rem);
  }

  .ov__kicker {
    font-size: clamp(0.5625rem, 1.6cqi, 0.6875rem);
    letter-spacing: 0.08em;
  }

  .timeline__stop {
    font-size: clamp(0.5625rem, 1.6cqi, 0.6875rem);
  }

  .ov__types {
    flex-direction: column;
    font-size: clamp(0.625rem, 1.7cqi, 0.75rem);
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
