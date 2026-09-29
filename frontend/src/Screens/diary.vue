<script setup lang="ts">
/**
 * Diario — cada vez que viste, leíste, jugaste o escuchaste algo, por fecha
 * (como el diary de Letterboxd). Agrupado por mes, con filtro por año y tipo.
 * Las entradas se crean solas al cambiar el estado de una obra.
 *
 * La pestaña "Resumen del año" muestra el reto anual (metas) y las
 * estadísticas del año elegido, calculadas desde el mismo diario.
 */
import { computed, onMounted, ref } from 'vue'
import BaseIcon from '../components/BaseIcon.vue'
import BaseTag from '../components/BaseTag.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import RatingStars from '../components/RatingStars.vue'
import YearGoals from '../components/YearGoals.vue'
import YearReview from '../components/YearReview.vue'
import { MEDIA_TYPES, statusLabel, typeMeta } from '../lib/catalog'
import { formatDay, formatMonth, parseISODay } from '../lib/dates'
import { logService } from '../services/logService'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'
import type { LogEntry } from '../types/log'
import type { MediaType } from '../types/media'

const ui = useUiStore()
const media = useMediaStore()

const logs = ref<LogEntry[]>([])
const loading = ref(true)
const failed = ref(false)

type Tab = 'diary' | 'review'
const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: 'diary', label: 'Diario', icon: 'journal-bookmark' },
  { value: 'review', label: 'Resumen del año', icon: 'bar-chart' },
]
const tab = ref<Tab>('diary')

onMounted(async () => {
  // Páginas y horas del resumen vienen de las obras de la colección.
  void media.ensureLoaded()
  try {
    logs.value = await logService.list()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

/** Día que ubica la entrada en el diario: cuándo terminó o, si sigue en curso, cuándo empezó. */
const dayOf = (log: LogEntry) => log.finishedAt ?? log.startedAt ?? log.createdAt.slice(0, 10)

const years = computed(() => {
  const set = new Set(logs.value.map((l) => Number(dayOf(l).slice(0, 4))))
  set.add(new Date().getFullYear())
  return [...set].sort((a, b) => b - a)
})

const year = ref(new Date().getFullYear())
const typeFilter = ref<MediaType | 'all'>('all')

const visible = computed(() =>
  logs.value.filter(
    (l) =>
      l.entry &&
      Number(dayOf(l).slice(0, 4)) === year.value &&
      (typeFilter.value === 'all' || l.entry.type === typeFilter.value),
  ),
)

const months = computed(() => {
  const groups = new Map<string, LogEntry[]>()
  for (const log of visible.value) {
    const key = dayOf(log).slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), log])
  }
  return [...groups.entries()].map(([key, items]) => ({ key, label: formatMonth(`${key}-01`), items }))
})

const summary = computed(() => {
  const finished = visible.value.filter((l) => l.finishedAt && !l.abandoned).length
  return `${finished} ${finished === 1 ? 'obra terminada' : 'obras terminadas'} en ${year.value}`
})

function describe(log: LogEntry): string {
  const type = log.entry!.type
  if (!log.finishedAt) return `${statusLabel(type, 'in-progress')} desde el ${formatDay(log.startedAt ?? dayOf(log))}`
  if (log.abandoned) return statusLabel(type, 'abandoned')
  if (log.startedAt && log.startedAt !== log.finishedAt) return `Del ${formatDay(log.startedAt)} al ${formatDay(log.finishedAt)}`
  return statusLabel(type, 'completed')
}

function open(log: LogEntry) {
  const e = log.entry!
  ui.openWorkDetail({
    type: e.type,
    title: e.title,
    creator: e.creator,
    year: e.year,
    genres: e.genres,
    cover: e.cover,
    externalId: e.externalId,
  })
}
</script>

<template>
  <header class="diary__head">
    <div>
      <h1 class="diary__title">Diario</h1>
      <p class="diary__count">{{ summary }}</p>
    </div>
    <select v-model.number="year" class="app-select diary__year" aria-label="Año">
      <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
    </select>
  </header>

  <div class="diary__tabs" role="tablist" aria-label="Secciones del diario">
    <button
      v-for="t in TABS"
      :key="t.value"
      type="button"
      role="tab"
      class="diary__tab"
      :class="{ 'is-active': tab === t.value }"
      :aria-selected="tab === t.value"
      @click="tab = t.value"
    >
      <BaseIcon :name="t.icon" /> {{ t.label }}
    </button>
  </div>

  <p v-if="loading" class="diary__hint"><BaseSpinner size="sm" /> Cargando tu diario…</p>
  <p v-else-if="failed" class="diary__hint">No se pudo cargar el diario.</p>

  <template v-else-if="tab === 'review'">
    <YearGoals :year="year" :logs="logs" />
    <YearReview :year="year" :logs="logs" @open="open" />
  </template>

  <template v-else>
  <div class="diary__filters">
    <BaseTag :active="typeFilter === 'all'" @click="typeFilter = 'all'">Todo</BaseTag>
    <BaseTag v-for="t in MEDIA_TYPES" :key="t.value" :active="typeFilter === t.value" @click="typeFilter = t.value">
      <BaseIcon :name="t.icon" /> {{ t.plural }}
    </BaseTag>
  </div>

  <EmptyState
    v-if="!months.length"
    icon="journal-bookmark"
    :title="`Nada registrado en ${year}`"
    text="Cuando empieces o termines algo, aparecerá aquí con su fecha."
  />

  <section v-for="m in months" :key="m.key" class="diary__month">
    <h2 class="diary__month-title">{{ m.label }}</h2>
    <ul class="diary__list">
      <li v-for="log in m.items" :key="log.id">
        <button type="button" class="diary__row" @click="open(log)">
          <span class="diary__day">{{ parseISODay(dayOf(log)).getDate() }}</span>
          <img v-if="log.entry!.cover" :src="log.entry!.cover" alt="" class="diary__cover" loading="lazy" />
          <span v-else class="diary__cover diary__cover--empty" aria-hidden="true">
            <BaseIcon :name="typeMeta(log.entry!.type).icon" />
          </span>
          <span class="diary__info">
            <span class="diary__work">{{ log.entry!.title }}</span>
            <span class="diary__meta">
              <BaseIcon :name="typeMeta(log.entry!.type).icon" />
              {{ describe(log) }}
              <span v-if="log.repeat" class="diary__badge"><BaseIcon name="arrow-repeat" /> Otra vez</span>
              <span v-if="!log.finishedAt" class="diary__badge diary__badge--live">En curso</span>
            </span>
          </span>
          <RatingStars v-if="log.rating != null" :value="log.rating" class="diary__stars" />
        </button>
      </li>
    </ul>
  </section>
  </template>
</template>

<style scoped>
.diary__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.diary__title {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0;
}

.diary__count {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
  margin: var(--space-xs) 0 0 0;
}

.diary__year {
  width: auto;
  min-width: 110px;
}

.diary__tabs {
  display: flex;
  gap: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.diary__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: -1px;
  padding: var(--space-sm) 2px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.diary__tab:hover {
  color: var(--color-text);
}

.diary__tab.is-active {
  color: var(--color-text);
  border-bottom-color: var(--color-accent);
}

.diary__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.diary__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text-muted);
}

.diary__month {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.diary__month-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--color-text);
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--color-border);
}

.diary__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.diary__row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.diary__row:hover,
.diary__row:focus-visible {
  border-color: var(--color-border);
}

.diary__day {
  width: 2ch;
  flex-shrink: 0;
  text-align: right;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.diary__cover {
  width: 40px;
  height: 60px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface-2);
}

.diary__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
}

.diary__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.diary__work {
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diary__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.diary__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  color: var(--color-accent);
}

.diary__badge--live {
  color: var(--color-warning);
}

.diary__stars {
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .diary__stars {
    display: none;
  }
}
</style>
