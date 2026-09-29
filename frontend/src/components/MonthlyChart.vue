<script setup lang="ts">
/**
 * MonthlyChart — barras de obras terminadas por mes (una sola serie, así que
 * sin leyenda: el título de la sección la nombra). Tooltip al pasar el mouse
 * por cada mes; sólo el mes con más obras lleva su número fijo.
 * Debajo, una tabla accesible con los mismos datos para lectores de pantalla.
 *
 * Uso:
 *   <MonthlyChart :values="[0, 2, 5, …12 valores]" />
 */
import { computed, ref } from 'vue'

const props = defineProps<{ values: number[] }>()

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const max = computed(() => Math.max(1, ...props.values))
const peak = computed(() => props.values.indexOf(Math.max(...props.values)))
const active = ref<number | null>(null)

const tooltip = (i: number) => {
  const n = props.values[i]
  return `${MONTH_NAMES[i].charAt(0).toUpperCase() + MONTH_NAMES[i].slice(1)}: ${n} ${n === 1 ? 'obra' : 'obras'}`
}
</script>

<template>
  <figure class="monthly">
    <div class="monthly__plot" aria-hidden="true" @mouseleave="active = null">
      <div
        v-for="(v, i) in values"
        :key="i"
        class="monthly__col"
        :class="{ 'is-active': active === i }"
        @mouseenter="active = i"
      >
        <span v-if="active === i" class="monthly__tip" role="tooltip">{{ tooltip(i) }}</span>
        <span v-else-if="i === peak && v > 0" class="monthly__peak">{{ v }}</span>
        <span class="monthly__bar" :style="{ height: v ? `${(v / max) * 100}%` : '0' }" />
      </div>
    </div>
    <div class="monthly__axis" aria-hidden="true">
      <span v-for="m in MONTHS" :key="m">{{ m }}</span>
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
  height: 140px;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 2px;
  align-items: end;
  border-bottom: 1px solid var(--color-border);
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
  width: min(70%, 28px);
  border-radius: 4px 4px 0 0;
  background: var(--color-accent);
  transition: opacity 0.15s ease;
}

.monthly__plot:hover .monthly__col:not(.is-active) .monthly__bar {
  opacity: 0.45;
}

.monthly__peak {
  margin-bottom: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text);
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
  gap: 2px;
  text-align: center;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
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
