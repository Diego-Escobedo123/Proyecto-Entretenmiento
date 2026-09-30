<script setup lang="ts">
/**
 * RatingHistogram — distribución de estrellas de ½ a 5 (10 barras, una
 * sola serie) con el promedio al lado, estilo Letterboxd. Tooltip por barra
 * y una lista equivalente para lectores de pantalla.
 * Lo usan la ficha de una obra (En Mosaic) y el perfil (Cómo califica).
 *
 * Uso:
 *   <RatingHistogram :histogram="[0,0,1,…10 valores]" :average="4.1" :count="12" />
 * `barsHeight` (px, 64 por defecto) agranda las barras donde sobra espacio.
 * `hideAverage`: sin el promedio al lado (quien lo usa lo muestra en otro lado)
 * y la gráfica ocupa todo el ancho.
 */
import { computed, ref } from 'vue'
import BaseIcon from './BaseIcon.vue'

const props = withDefaults(
  defineProps<{ histogram: number[]; average: number | null; count: number; barsHeight?: number; hideAverage?: boolean }>(),
  { barsHeight: 64, hideAverage: false },
)

const maxBar = computed(() => Math.max(1, ...props.histogram))
const active = ref<number | null>(null)

/** Barra i = (i + 1) medias estrellas. */
const starsLabel = (i: number) => {
  const value = (i + 1) / 2
  return `${value.toLocaleString('es')} ${value === 1 ? 'estrella' : 'estrellas'}`
}
const barTooltip = (i: number) => {
  const n = props.histogram[i] ?? 0
  return `${starsLabel(i)}: ${n} ${n === 1 ? 'calificación' : 'calificaciones'}`
}

const averageText = computed(() =>
  props.average?.toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? '',
)
const summary = computed(
  () => `Promedio ${averageText.value} de 5 con ${props.count} ${props.count === 1 ? 'calificación' : 'calificaciones'}`,
)
</script>

<template>
  <div class="histogram">
    <figure class="histogram__figure" :class="{ 'histogram__figure--full': hideAverage }" :aria-label="summary" role="img">
      <div class="histogram__bars" :style="{ height: `${barsHeight}px` }" @mouseleave="active = null">
        <div
          v-for="(n, i) in histogram"
          :key="i"
          class="histogram__col"
          :class="{ 'is-active': active === i }"
          @mouseenter="active = i"
        >
          <span v-if="active === i" class="histogram__tip" role="tooltip">{{ barTooltip(i) }}</span>
          <span class="histogram__bar" :style="{ height: n ? `${(n / maxBar) * 100}%` : '2px' }" :class="{ 'is-empty': !n }" />
        </div>
      </div>
      <div class="histogram__axis" aria-hidden="true">
        <span><BaseIcon name="star-half" /></span>
        <span class="histogram__axis-max">
          <BaseIcon v-for="k in 5" :key="k" name="star-fill" />
        </span>
      </div>
    </figure>

    <div v-if="!hideAverage" class="histogram__average">
      <strong>{{ averageText }}</strong>
      <span>{{ count }} {{ count === 1 ? 'calificación' : 'calificaciones' }}</span>
    </div>

    <!-- Misma información para lectores de pantalla -->
    <ul class="histogram__sr">
      <li v-for="i in histogram.length" :key="i">{{ barTooltip(i - 1) }}</li>
    </ul>
  </div>
</template>

<style scoped>
.histogram {
  display: flex;
  align-items: flex-end;
  gap: var(--space-lg);
}

.histogram__figure {
  flex: 1;
  max-width: 420px;
  margin: 0;
}

.histogram__figure--full {
  max-width: none;
}

.histogram__bars {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 2px;
  align-items: end;
  border-bottom: 1px solid var(--color-border);
}

/* La columna entera es el área de hover: más grande que la barra. */
.histogram__col {
  position: relative;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.histogram__bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  background: var(--color-accent);
  transition: opacity 0.15s ease;
}

.histogram__bar.is-empty {
  background: var(--color-surface-2);
}

.histogram__bars:hover .histogram__col:not(.is-active) .histogram__bar {
  opacity: 0.45;
}

.histogram__tip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
  pointer-events: none;
  z-index: 1;
}

.histogram__axis {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 0.625rem;
  color: var(--color-text-subtle);
}

.histogram__axis-max {
  display: inline-flex;
  gap: 1px;
}

.histogram__average {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}

.histogram__average strong {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-text);
}

.histogram__average span {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.histogram__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
