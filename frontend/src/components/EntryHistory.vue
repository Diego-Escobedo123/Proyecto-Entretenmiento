<script setup lang="ts">
/**
 * EntryHistory — historial del diario de UNA obra: cada vez que se vio, leyó,
 * jugó o escuchó, con sus fechas, calificación y si fue una repetición.
 * Permite corregir fechas, borrar entradas y registrarla otra vez.
 *
 * Películas y álbumes se registran otra vez aquí mismo (fecha + estrellas).
 * Series, libros y juegos tienen avance, así que "volver a leerlo" emite
 * `restart` y el formulario la pasa a "en progreso": al guardar se abre una
 * entrada nueva marcada como repetición.
 *
 * Uso:
 *   <EntryHistory :entry-id="id" :type="type" :finished="true" @restart="..." @changed="..." />
 */
import { computed, ref, watch } from 'vue'
import BaseIcon from './BaseIcon.vue'
import BaseButton from './BaseButton.vue'
import BaseSpinner from './BaseSpinner.vue'
import RatingStars from './RatingStars.vue'
import { statusLabel } from '../lib/catalog'
import { formatDay, todayISO } from '../lib/dates'
import { logService } from '../services/logService'
import type { LogEntry } from '../types/log'
import type { MediaType } from '../types/media'

const props = defineProps<{ entryId: string; type: MediaType; finished: boolean }>()
const emit = defineEmits<{ restart: []; changed: [] }>()

const logs = ref<LogEntry[]>([])
const loading = ref(false)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    logs.value = await logService.list(props.entryId)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

watch(() => props.entryId, load, { immediate: true })

/** Películas y álbumes no tienen avance: se registran de una vez, con fecha. */
const instantLog = computed(() => props.type === 'movie' || props.type === 'music')

const AGAIN_LABEL: Record<MediaType, string> = {
  movie: 'Volver a verla',
  series: 'Volver a verla',
  book: 'Volver a leerlo',
  game: 'Volver a jugarlo',
  music: 'Volver a escucharlo',
}

function describe(log: LogEntry): string {
  if (!log.finishedAt) {
    const since = log.startedAt ? ` desde el ${formatDay(log.startedAt)}` : ''
    return `${statusLabel(props.type, 'in-progress')}${since}`
  }
  const verb = statusLabel(props.type, log.abandoned ? 'abandoned' : 'completed')
  if (log.startedAt && !instantLog.value) return `${verb}: del ${formatDay(log.startedAt)} al ${formatDay(log.finishedAt)}`
  return `${verb} el ${formatDay(log.finishedAt)}`
}

// --- Registrar otra vez (películas / álbumes) ---

const adding = ref(false)
const newDate = ref(todayISO())
const newRating = ref(0)
const saving = ref(false)

function startAgain() {
  if (!instantLog.value) {
    emit('restart')
    return
  }
  newDate.value = todayISO()
  newRating.value = 0
  adding.value = true
}

async function saveAgain() {
  if (saving.value) return
  saving.value = true
  try {
    await logService.create(props.entryId, {
      finishedAt: newDate.value || todayISO(),
      rating: newRating.value > 0 ? newRating.value : null,
    })
    adding.value = false
    await load()
    emit('changed')
  } finally {
    saving.value = false
  }
}

// --- Corregir fechas / borrar ---

const editingId = ref<string | null>(null)
const draft = ref({ startedAt: '', finishedAt: '' })

function startEdit(log: LogEntry) {
  editingId.value = log.id
  draft.value = { startedAt: log.startedAt ?? '', finishedAt: log.finishedAt ?? '' }
}

async function saveEdit(log: LogEntry) {
  const updated = await logService.update(log.id, {
    startedAt: draft.value.startedAt || null,
    finishedAt: draft.value.finishedAt || null,
  })
  logs.value = logs.value.map((l) => (l.id === log.id ? updated : l))
  editingId.value = null
}

async function remove(log: LogEntry) {
  await logService.remove(log.id)
  logs.value = logs.value.filter((l) => l.id !== log.id)
}
</script>

<template>
  <section class="history">
    <header class="history__head">
      <h4 class="history__title"><BaseIcon name="journal-bookmark" /> Tu historial</h4>
      <button v-if="finished && !adding" type="button" class="history__again" @click="startAgain">
        <BaseIcon name="arrow-repeat" /> {{ AGAIN_LABEL[type] }}
      </button>
    </header>

    <div v-if="adding" class="history__new">
      <label class="history__field">
        <span>{{ statusLabel(type, 'completed') }} el</span>
        <input v-model="newDate" type="date" :max="todayISO()" class="app-input" />
      </label>
      <label class="history__field">
        <span>Calificación de esta vez</span>
        <RatingStars :value="newRating" editable @update:value="newRating = $event" />
      </label>
      <div class="history__actions">
        <BaseButton variant="ghost" @click="adding = false">Cancelar</BaseButton>
        <BaseButton :disabled="saving" @click="saveAgain">Registrar</BaseButton>
      </div>
    </div>

    <p v-if="loading" class="history__hint"><BaseSpinner size="sm" /> Cargando…</p>
    <p v-else-if="failed" class="history__hint">No se pudo cargar el historial.</p>
    <p v-else-if="!logs.length" class="history__hint">Aún no hay registros en tu diario.</p>

    <ul v-else class="history__list">
      <li v-for="log in logs" :key="log.id" class="history__item">
        <template v-if="editingId === log.id">
          <div class="history__dates">
            <label v-if="!instantLog" class="history__field">
              <span>Empezó</span>
              <input v-model="draft.startedAt" type="date" :max="todayISO()" class="app-input" />
            </label>
            <label class="history__field">
              <span>{{ log.abandoned ? 'Lo dejó' : 'Terminó' }}</span>
              <input v-model="draft.finishedAt" type="date" :max="todayISO()" class="app-input" />
            </label>
          </div>
          <div class="history__actions">
            <BaseButton variant="ghost" @click="editingId = null">Cancelar</BaseButton>
            <BaseButton @click="saveEdit(log)">Guardar</BaseButton>
          </div>
        </template>

        <template v-else>
          <div class="history__text">
            <span>{{ describe(log) }}</span>
            <span class="history__meta">
              <RatingStars v-if="log.rating != null" :value="log.rating" />
              <span v-if="log.repeat" class="history__badge"><BaseIcon name="arrow-repeat" /> Otra vez</span>
            </span>
          </div>
          <div class="history__buttons">
            <button type="button" class="history__icon" aria-label="Corregir fechas" title="Corregir fechas" @click="startEdit(log)">
              <BaseIcon name="pencil" />
            </button>
            <button type="button" class="history__icon" aria-label="Borrar del diario" title="Borrar del diario" @click="remove(log)">
              <BaseIcon name="trash" />
            </button>
          </div>
        </template>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.history__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.history__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text);
}

.history__again {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
}

.history__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.history__new,
.history__item {
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.history__new {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
  font-size: 0.8125rem;
  color: var(--color-text);
}

.history__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.history__meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.history__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
}

.history__buttons {
  display: flex;
  gap: 4px;
}

.history__icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}

.history__icon:hover {
  color: var(--color-text);
}

.history__dates {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  flex: 1;
}

.history__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history__field > span {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.history__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  width: 100%;
}
</style>
