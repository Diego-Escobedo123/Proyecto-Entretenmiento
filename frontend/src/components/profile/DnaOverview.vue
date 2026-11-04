<script setup lang="ts">
/**
 * DnaOverview — "ADN cultural" completo del perfil público: dona de géneros,
 * década favorita y formato dominante como historias con stickers (DnaStory),
 * y los insights como cartas (ver ProfileInsights). `self` pasa los textos
 * a segunda persona.
 * Se adapta al ancho de su tarjeta (container queries), no al de la ventana.
 *
 * Uso:
 *   <DnaOverview :dna="profile.dna" :ratings="profile.ratings" :activity="profile.activity"
 *                :last-abandoned="profile.lastAbandoned" :insights="profile.insights" self />
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import { useInView } from '../../composables/useInView'
import DnaStory from './DnaStory.vue'
import ProfileInsights from './ProfileInsights.vue'
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

// --- Dona de géneros ---

/** La dona se dibuja cuando llega a verse, no al cargar la página. */
const donutEl = ref<HTMLElement | null>(null)
const donutInView = useInView(donutEl)
const otherPercent = computed(() => {
  if (!props.dna.topGenres.length) return 0
  return Math.max(0, 100 - props.dna.topGenres.reduce((sum, g) => sum + g.percent, 0))
})

/** Porciones de la dona, en orden (desde arriba, en el sentido del reloj). */
const slices = computed(() => {
  let acc = 0
  return [
    ...props.dna.topGenres.map((g, i) => ({ name: g.name, percent: g.percent, color: GENRE_COLORS[i] })),
    ...(otherPercent.value > 0 ? [{ name: OTHER_GENRES_LABEL, percent: otherPercent.value, color: OTHER_GENRES_COLOR }] : []),
  ].map((s) => {
    const start = acc
    acc += s.percent
    return { ...s, start, end: acc }
  })
})

const donutGradient = computed(() => {
  if (!slices.value.length) return `conic-gradient(${OTHER_GENRES_COLOR} 0% 100%)`
  // 1% de separación entre porciones, del color de la tarjeta.
  const stops = slices.value.flatMap((s) => {
    const cut = Math.max(s.start, s.end - 1)
    return [`${s.color} ${s.start}% ${cut}%`, `var(--color-surface) ${cut}% ${s.end}%`]
  })
  return `conic-gradient(${stops.join(', ')})`
})

/*
 * Globito flotante: al pasar el mouse por un color (o tocarlo en el teléfono)
 * muestra ese género junto al cursor. El centro siempre queda con el dominante.
 */
type Slice = (typeof slices.value)[number]
const tip = ref<{ slice: Slice; x: number; y: number } | null>(null)
/** El globito lo abrió un toque: se cierra al tocar fuera, no al levantar el dedo. */
let tipFromTouch = false

/** Radio del agujero respecto del de la dona (`.donut__hole` tiene inset 13%). */
const HOLE_RATIO = 0.74

function sliceAt(e: PointerEvent): Slice | null {
  const el = donutEl.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const radius = rect.width / 2
  const dx = e.clientX - (rect.left + radius)
  const dy = e.clientY - (rect.top + radius)
  const dist = Math.hypot(dx, dy)
  if (dist > radius || dist < radius * HOLE_RATIO) return null
  // Ángulo desde arriba en el sentido del reloj, como el conic-gradient.
  const percent = (((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360) / 3.6
  return slices.value.find((s) => percent >= s.start && percent < s.end) ?? null
}

function showTip(e: PointerEvent) {
  const slice = sliceAt(e)
  const rect = donutEl.value?.getBoundingClientRect()
  tipFromTouch = e.pointerType !== 'mouse'
  tip.value = slice && rect ? { slice, x: e.clientX - rect.left, y: e.clientY - rect.top } : null
}

function hideTip(e: PointerEvent) {
  if (e.pointerType === 'mouse') tip.value = null
}

function onDocumentPointerDown(e: PointerEvent) {
  if (tipFromTouch && tip.value && !donutEl.value?.contains(e.target as Node)) tip.value = null
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
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
          <div
            ref="donutEl"
            class="donut"
            :class="{ 'is-revealed': donutInView }"
            :style="{ '--donut': donutGradient }"
            role="img"
            :aria-label="slices.map((s) => `${s.name} ${s.percent}%`).join(', ') || 'Sin géneros'"
            @pointermove="showTip"
            @pointerdown="showTip"
            @pointerleave="hideTip"
          >
            <div class="donut__hole">
              <template v-if="dna.topGenres.length">
                <strong>{{ dna.topGenres[0].percent }}%</strong>
                <span>{{ dna.topGenres[0].name }}</span>
              </template>
              <span v-else>Sin géneros</span>
            </div>
            <span
              v-if="tip"
              class="donut__tip"
              :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
              aria-hidden="true"
            >
              <span class="donut__dot" :style="{ background: tip.slice.color }" />
              {{ tip.slice.name }} · <strong>{{ tip.slice.percent }}%</strong>
            </span>
          </div>
        </div>

        <!-- Década y formato: dos historias lado a lado -->
        <div class="ov__facts">
          <DnaStory kind="decade" :decade="dna.favoriteDecade?.decade" :percent="dna.favoriteDecade?.percent" :self="self" />
          <DnaStory kind="format" :shares="dna.typeShares" :self="self" />
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

  /* Sin la lista debajo, la dona queda centrada a la altura de las historias. */
  .ov__genres {
    align-self: center;
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

/* El anillo de colores se dibuja en círculo al aparecer; el centro llega después. */
.donut::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--donut);
  -webkit-mask: conic-gradient(#000 var(--mosaic-sweep), transparent 0);
  mask: conic-gradient(#000 var(--mosaic-sweep), transparent 0);
  animation: mosaic-sweep 900ms var(--ease-out) both paused;
}

/* En pausa (vacía) hasta que la dona entra en pantalla. */
.donut.is-revealed::before,
.donut.is-revealed .donut__hole {
  animation-play-state: running;
}

.donut__hole {
  position: absolute;
  inset: 13%;
  animation: mosaic-fade-up var(--dur-base) var(--ease-out) 500ms both paused;
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

/* Globito con el género bajo el cursor: arriba del puntero, sin tapar el color. */
.donut__tip {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.3);
  color: var(--color-text);
  font-size: 0.8125rem;
  white-space: nowrap;
  pointer-events: none;
  /* `translate` (no `transform`) para que la animación de entrada no lo mueva. */
  translate: -50% calc(-100% - 12px);
  animation: mosaic-fade-up var(--dur-fast) var(--ease-out) both;
}

.donut__tip strong {
  font-weight: 800;
}

.donut__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
