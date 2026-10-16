<script setup lang="ts">
/**
 * MonthlyChart — barras de obras terminadas por mes (una sola serie, así que
 * sin leyenda: el título de la sección la nombra). Tooltip al pasar el mouse
 * por cada mes; sólo el mes con más obras lleva su número fijo.
 * - Los meses sin nada llevan una marquita (la línea base no queda vacía).
 * - Con `year` del año en curso, los meses que aún no llegan van punteados:
 *   no son "cero", todavía no pasan.
 * - Las barras crecen en ola cuando la gráfica entra en pantalla.
 * Debajo, una tabla accesible con los mismos datos para lectores de pantalla.
 *
 * Uso:
 *   <MonthlyChart :values="[0, 2, 5, …12 valores]" :year="2026" />
 */
import { computed, ref } from 'vue'
import { useInView } from '../composables/useInView'

const props = defineProps<{ values: number[]; year?: number }>()

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const max = computed(() => Math.max(1, ...props.values))
const peak = computed(() => props.values.indexOf(Math.max(...props.values)))
const active = ref<number | null>(null)

/** Meses que todavía no llegan (sólo en el año en curso). */
const now = new Date()
const isFuture = (i: number) => props.year === now.getFullYear() && i > now.getMonth()

const tooltip = (i: number) => {
  const name = MONTH_NAMES[i].charAt(0).toUpperCase() + MONTH_NAMES[i].slice(1)
  if (isFuture(i)) return `${name}: todavía no llega`
  const n = props.values[i]
  return `${name}: ${n} ${n === 1 ? 'obra' : 'obras'}`
}

const plotEl = ref<HTMLElement | null>(null)
const inView = useInView(plotEl)
</script>

<template>
  <figure class="monthly">
    <div
      ref="plotEl"
      class="monthly__plot"
      :class="{ 'is-revealed': inView }"
      aria-hidden="true"
      @mouseleave="active = null"
    >
      <div
        v-for="(v, i) in values"
        :key="i"
        class="monthly__col"
        :class="{ 'is-active': active === i }"
        @mouseenter="active = i"
      >
        <span v-if="active === i" class="monthly__tip" role="tooltip">{{ tooltip(i) }}</span>
        <span v-else-if="i === peak && v > 0" class="monthly__peak">{{ v }}</span>
        <span v-if="isFuture(i)" class="monthly__bar monthly__bar--future" />
        <span v-else-if="!v" class="monthly__bar monthly__bar--empty" />
        <span
          v-else
          class="monthly__bar"
          :class="{ 'is-peak': i === peak }"
          :style="{ height: `${(v / max) * 100}%`, '--i': i }"
        />
      </div>
    </div>
    <div class="monthly__axis" aria-hidden="true">
      <span v-for="(m, i) in MONTHS" :key="m" :class="{ 'is-peak': i === peak && values[i] > 0 }">{{ m }}</span>
    </div>

    <table class="monthly__table">
      <caption>Obras terminadas por mes</caption>
      <tbody>
        <tr v-for="(v, i) in values" :key="i">
          <th scope="row">{{ MONTH_NAMES[i] }}</th>
          <td>{{ v }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
.monthly {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.monthly__plot {
  height: 150px;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 4px;
  align-items: end;
  border-bottom: 1px solid var(--color-border);
  /* Líneas guía tenues a 1/3 y 2/3 de la altura. */
  background-image: linear-gradient(to top, var(--color-border) 1px, transparent 1px);
  background-size: 100% 33.33%;
  background-position: bottom;
}

/* La columna entera es el área de hover: más grande que la barra. */
.monthly__col {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  cursor: default;
}

.monthly__bar {
  width: min(70%, 26px);
  min-height: 4px;
  border-radius: 6px 6px 2px 2px;
  background: linear-gradient(to top, color-mix(in srgb, var(--color-accent) 55%, var(--color-surface)), var(--color-accent));
  transform-origin: bottom;
  transition: opacity var(--dur-fast) ease;
  /* Crece desde la base en ola; en pausa (aplanada) hasta entrar en pantalla. */
  animation: monthly-grow 500ms var(--ease-out) both paused;
  animation-delay: calc(var(--i, 0) * 35ms);
}

.monthly__plot.is-revealed .monthly__bar {
  animation-play-state: running;
}

@keyframes monthly-grow {
  from {
    transform: scaleY(0);
  }
}

/* El mes más activo, con un brillo que lo destaca. */
.monthly__bar.is-peak {
  background: var(--color-accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--color-accent) 45%, transparent);
}

/* Mes sin nada: una marquita en la base. */
.monthly__bar--empty {
  height: 4px;
  background: var(--color-surface-2);
}

/* Mes que aún no llega: punteado, sin relleno. */
.monthly__bar--future {
  height: 4px;
  background: none;
  border-top: 2px dotted var(--color-border);
  border-radius: 0;
}

.monthly__plot:hover .monthly__col:not(.is-active) .monthly__bar {
  opacity: 0.45;
}

.monthly__peak {
  margin-bottom: 4px;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--color-accent);
}

.monthly__tip {
  position: absolute;
  bottom: calc(100% - 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
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

.monthly__axis {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 4px;
  text-align: center;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.monthly__axis .is-peak {
  color: var(--color-accent);
  font-weight: 700;
}

/* Tabla sólo para lectores de pantalla. */
.monthly__table {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
