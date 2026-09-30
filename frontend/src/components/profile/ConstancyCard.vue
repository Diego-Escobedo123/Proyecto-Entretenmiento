<script setup lang="ts">
/**
 * ConstancyCard — "Constancia", al estilo de las contribuciones de GitHub:
 * una columna por semana del último año y una fila por día, con los meses
 * arriba y Lun/Mié/Vie a la izquierda. Cada cuadro se colorea según cuántas
 * veces se empezó o terminó algo ese día (del diario). Los cuadros se estiran
 * para llenar el ancho; si no caben (móvil), la grilla se desplaza y arranca
 * mostrando los días más recientes.
 *
 * Uso:
 *   <ConstancyCard :days="['2026-09-01', …]" self />
 */
import { computed, nextTick, ref, watch } from 'vue'
import { buildHeatmap, type HeatmapDay } from '../../lib/heatmap'
import { parseISODay } from '../../lib/dates'

const props = defineProps<{ days: string[]; self?: boolean }>()

const cells = computed(() => buildHeatmap(props.days))

/** Semanas (columnas) de domingo a sábado; la última puede estar incompleta. */
const weeks = computed(() => {
  const out: HeatmapDay[][] = []
  for (let i = 0; i < cells.value.length; i += 7) out.push(cells.value.slice(i, i + 7))
  return out
})

/** Etiqueta de mes en la primera semana de cada mes ("Oct", "Nov"…), como en GitHub. */
const monthLabels = computed(() => {
  const labels: { column: number; label: string }[] = []
  let previous = -1
  weeks.value.forEach((week, i) => {
    const month = parseISODay(week[0].date).getMonth()
    if (month !== previous) {
      // Si el año arranca a mitad de semana, la primera columna no lleva etiqueta (quedaría encimada).
      if (i > 0 || week.length === 7) {
        const text = parseISODay(week[0].date).toLocaleDateString('es', { month: 'short' }).replace('.', '')
        labels.push({ column: i, label: text.charAt(0).toUpperCase() + text.slice(1) })
      }
      previous = month
    }
  })
  // Una etiqueta pegada a la siguiente (menos de 3 semanas) se omite para que no se encimen.
  return labels.filter((l, i) => i === labels.length - 1 || labels[i + 1].column - l.column >= 3)
})

/** Filas con nombre (0 = domingo): Lun, Mié, Vie. */
const WEEKDAY_LABELS = [
  { row: 1, label: 'Lun' },
  { row: 3, label: 'Mié' },
  { row: 5, label: 'Vie' },
]

const total = computed(() => props.days.length)

const gridEl = ref<HTMLElement | null>(null)
watch(
  [gridEl, cells],
  async () => {
    await nextTick()
    if (gridEl.value) gridEl.value.scrollLeft = gridEl.value.scrollWidth
  },
  { flush: 'post' },
)

const cellTitle = (day: HeatmapDay) =>
  `${day.count === 0 ? 'Nada' : `${day.count} ${day.count === 1 ? 'registro' : 'registros'}`} el ${day.label}`
</script>

<template>
  <div class="card constancy">
    <div class="card__header">
      <h2 class="card__title">Constancia</h2>
      <span class="card__header-label">
        {{ total }} {{ total === 1 ? 'registro' : 'registros' }} en el último año
      </span>
    </div>

    <div ref="gridEl" class="constancy__scroll">
      <div
        class="constancy__grid"
        :style="{ gridTemplateColumns: `auto repeat(${weeks.length}, minmax(6px, 1fr))` }"
        role="img"
        :aria-label="`${total} registros en ${self ? 'tu' : 'su'} diario en el último año`"
      >
        <span
          v-for="m in monthLabels"
          :key="m.column"
          class="constancy__month"
          :style="{ gridColumn: m.column + 2, gridRow: 1 }"
        >
          {{ m.label }}
        </span>
        <span
          v-for="d in WEEKDAY_LABELS"
          :key="d.label"
          class="constancy__weekday"
          :style="{ gridColumn: 1, gridRow: d.row + 2 }"
        >
          {{ d.label }}
        </span>
        <template v-for="(week, w) in weeks" :key="w">
          <span
            v-for="(day, d) in week"
            :key="day.date"
            class="constancy__cell"
            :class="`constancy__cell--${day.level}`"
            :style="{ gridColumn: w + 2, gridRow: d + 2 }"
            :title="cellTitle(day)"
          />
        </template>
      </div>
    </div>

    <div class="constancy__footer">
      <span class="constancy__note">
        Días en que {{ self ? 'empezaste o terminaste' : 'empezó o terminó' }} algo según {{ self ? 'tu' : 'su' }} diario
      </span>
      <span class="constancy__legend" aria-hidden="true">
        Menos
        <span v-for="n in 5" :key="n" class="constancy__cell" :class="`constancy__cell--${n - 1}`" />
        Más
      </span>
    </div>
  </div>
</template>

<style scoped>
.card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
  margin-bottom: var(--space-md);
}

.card__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.card__header-label {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.constancy__scroll {
  overflow-x: auto;
  padding-bottom: var(--space-xs);
}

/* Una sola grilla: fila 1 = meses, filas 2–8 = días; columna 1 = Lun/Mié/Vie. */
.constancy__grid {
  display: grid;
  grid-template-rows: auto repeat(7, auto);
  gap: 2px;
  min-width: min-content;
  width: 100%;
}

.constancy__month {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  padding-bottom: 4px;
  /* La etiqueta puede ser más ancha que su columna: se extiende sobre las siguientes. */
  overflow: visible;
  width: 0;
}

.constancy__weekday {
  display: flex;
  align-items: center;
  padding-right: 8px;
  font-size: 0.75rem;
  line-height: 1;
  color: var(--color-text-muted);
}

.constancy__cell {
  display: block;
  aspect-ratio: 1;
  border-radius: 3px;
  background: var(--color-surface-2);
  outline: 1px solid rgb(0 0 0 / 0.06);
  outline-offset: -1px;
}

.constancy__cell--1 {
  background: color-mix(in srgb, var(--color-accent) 30%, var(--color-surface-2));
}

.constancy__cell--2 {
  background: color-mix(in srgb, var(--color-accent) 55%, var(--color-surface-2));
}

.constancy__cell--3 {
  background: color-mix(in srgb, var(--color-accent) 80%, var(--color-surface-2));
}

.constancy__cell--4 {
  background: var(--color-accent);
}

.constancy__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: auto;
  padding-top: var(--space-md);
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
}

.constancy__legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.constancy__legend .constancy__cell {
  width: 12px;
  height: 12px;
}
</style>
