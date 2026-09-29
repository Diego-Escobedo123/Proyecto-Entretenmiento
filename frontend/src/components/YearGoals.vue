<script setup lang="ts">
/**
 * YearGoals — reto anual (como el Reading Challenge de Goodreads): metas de
 * "terminar N libros/películas/… este año", con su avance según el diario.
 *
 * Uso:
 *   <YearGoals :year="2026" :logs="logs" />
 */
import { computed, ref, watch } from 'vue'
import BaseIcon from './BaseIcon.vue'
import BaseButton from './BaseButton.vue'
import ProgressBar from './ProgressBar.vue'
import { MEDIA_TYPES } from '../lib/catalog'
import { goalProgress } from '../lib/yearStats'
import { goalService } from '../services/goalService'
import type { Goal } from '../types/goal'
import type { LogEntry } from '../types/log'
import type { MediaType } from '../types/media'

const props = defineProps<{ year: number; logs: LogEntry[] }>()

const goals = ref<Goal[]>([])
const failed = ref(false)

watch(
  () => props.year,
  async (year) => {
    failed.value = false
    try {
      goals.value = await goalService.list(year)
    } catch {
      failed.value = true
    }
  },
  { immediate: true },
)

const GOAL_OPTIONS: { value: MediaType | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'Obras (cualquier tipo)', icon: 'collection' },
  ...MEDIA_TYPES.map((t) => ({ value: t.value, label: t.plural, icon: t.icon })),
]
const optionOf = (type: MediaType | 'all') => GOAL_OPTIONS.find((o) => o.value === type) ?? GOAL_OPTIONS[0]

const isCurrentYear = computed(() => props.year === new Date().getFullYear())

const rows = computed(() =>
  goals.value.map((g) => {
    const done = goalProgress(props.logs, props.year, g.type)
    return { goal: g, done, percent: Math.min(100, Math.round((done / g.target) * 100)), meta: optionOf(g.type) }
  }),
)

/** Ritmo: cuántas debería llevar a hoy para cumplir la meta. */
function paceText(done: number, target: number): string {
  if (done >= target) return '¡Meta cumplida!'
  if (!isCurrentYear.value) return `Faltaron ${target - done}`
  const now = new Date()
  const start = new Date(props.year, 0, 1).getTime()
  const end = new Date(props.year + 1, 0, 1).getTime()
  const expected = Math.floor(((now.getTime() - start) / (end - start)) * target)
  const diff = done - expected
  if (diff > 0) return `Vas ${diff} por delante`
  if (diff < 0) return `Vas ${-diff} por detrás`
  return 'Vas al día'
}

// --- Crear / editar ---

const editing = ref(false)
const draftType = ref<MediaType | 'all'>('book')
const draftTarget = ref<number>(12)
const saving = ref(false)
const error = ref('')

const availableOptions = computed(() => GOAL_OPTIONS.filter((o) => !goals.value.some((g) => g.type === o.value)))

function startNew() {
  draftType.value = availableOptions.value[0]?.value ?? 'all'
  draftTarget.value = 12
  error.value = ''
  editing.value = true
}

function startEdit(goal: Goal) {
  draftType.value = goal.type
  draftTarget.value = goal.target
  error.value = ''
  editing.value = true
}

async function save() {
  if (saving.value) return
  if (!Number.isInteger(draftTarget.value) || draftTarget.value < 1) {
    error.value = 'Escribe cuántas quieres terminar (1 o más).'
    return
  }
  saving.value = true
  try {
    const saved = await goalService.save({ year: props.year, type: draftType.value, target: draftTarget.value })
    goals.value = [...goals.value.filter((g) => g.type !== saved.type), saved]
    editing.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar la meta.'
  } finally {
    saving.value = false
  }
}

async function remove(goal: Goal) {
  await goalService.remove(goal.id)
  goals.value = goals.value.filter((g) => g.id !== goal.id)
}
</script>

<template>
  <section class="goals">
    <header class="goals__head">
      <h2 class="goals__title"><BaseIcon name="trophy" /> Reto {{ year }}</h2>
      <button v-if="!editing && availableOptions.length" type="button" class="goals__add" @click="startNew">
        + Agregar meta
      </button>
    </header>

    <p v-if="failed" class="goals__hint">No se pudieron cargar tus metas.</p>
    <p v-else-if="!goals.length && !editing" class="goals__hint">
      Ponte una meta para {{ year }}: por ejemplo, leer 12 libros o ver 50 películas.
    </p>

    <ul v-if="rows.length" class="goals__list">
      <li v-for="r in rows" :key="r.goal.id" class="goals__item">
        <div class="goals__row">
          <span class="goals__label">
            <BaseIcon :name="r.meta.icon" />
            <strong>{{ r.done }}</strong> de {{ r.goal.target }} {{ r.meta.label.toLowerCase() }}
          </span>
          <span class="goals__buttons">
            <button type="button" class="goals__icon" aria-label="Cambiar meta" title="Cambiar meta" @click="startEdit(r.goal)">
              <BaseIcon name="pencil" />
            </button>
            <button type="button" class="goals__icon" aria-label="Quitar meta" title="Quitar meta" @click="remove(r.goal)">
              <BaseIcon name="trash" />
            </button>
          </span>
        </div>
        <ProgressBar :percent="r.percent" />
        <span class="goals__pace" :class="{ 'is-done': r.done >= r.goal.target }">
          {{ r.percent }}% · {{ paceText(r.done, r.goal.target) }}
        </span>
      </li>
    </ul>

    <form v-if="editing" class="goals__form" @submit.prevent="save">
      <label class="goals__field">
        <span>Quiero terminar</span>
        <input v-model.number="draftTarget" type="number" min="1" max="10000" class="app-input goals__number" />
      </label>
      <label class="goals__field">
        <span>de</span>
        <select v-model="draftType" class="app-select">
          <option
            v-for="o in GOAL_OPTIONS"
            :key="o.value"
            :value="o.value"
            :disabled="o.value !== draftType && goals.some((g) => g.type === o.value)"
          >
            {{ o.label }}
          </option>
        </select>
      </label>
      <span class="goals__field-suffix">en {{ year }}</span>
      <p v-if="error" class="goals__error">{{ error }}</p>
      <div class="goals__actions">
        <BaseButton variant="ghost" @click="editing = false">Cancelar</BaseButton>
        <BaseButton type="submit" :disabled="saving">Guardar meta</BaseButton>
      </div>
    </form>
  </section>
</template>

<style scoped>
.goals {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.goals__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.goals__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-text);
}

.goals__add {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
}

.goals__hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.goals__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.goals__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.goals__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.goals__label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9375rem;
  color: var(--color-text);
}

.goals__buttons {
  display: flex;
  gap: 4px;
}

.goals__icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  cursor: pointer;
}

.goals__icon:hover {
  color: var(--color-text);
}

.goals__pace {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.goals__pace.is-done {
  color: var(--color-success);
  font-weight: 600;
}

.goals__form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.goals__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.goals__field > span {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.goals__number {
  width: 100px;
}

.goals__field-suffix {
  padding-bottom: 10px;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.goals__error {
  width: 100%;
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-danger);
}

.goals__actions {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}
</style>
