<script setup lang="ts">
/**
 * EntryFormModal — alta y edición de una obra. Se controla desde `useUiStore`:
 * si `editingEntryId` es null es alta, si trae id es edición.
 * Escribe a través de `useMediaStore` (que a su vez usa el servicio).
 */
import { computed, reactive, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import AppField from './AppField.vue'
import RatingStars from './RatingStars.vue'
import { MEDIA_STATUSES, MEDIA_TYPES, typeMeta } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'
import { searchService } from '../services/searchService'
import type { MediaEntryInput, MediaStatus, MediaType } from '../types/media'
import type { ExternalSearchResult } from '../types/search'

const ui = useUiStore()
const media = useMediaStore()

const modalRef = ref<InstanceType<typeof BaseModal> | null>(null)
function closeAnimated() {
  modalRef.value?.requestClose()
}

const editing = computed(() =>
  ui.editingEntryId ? media.getById(ui.editingEntryId) ?? null : null,
)

interface FormShape {
  type: MediaType
  title: string
  creator: string
  year: string
  status: MediaStatus
  rating: number
  progress: number
  favorite: boolean
  genres: string
  cover: string
  notes: string
}

function blank(): FormShape {
  return {
    type: 'movie',
    title: '',
    creator: '',
    year: '',
    status: 'want',
    rating: 0,
    progress: 0,
    favorite: false,
    genres: '',
    cover: '',
    notes: '',
  }
}

const form = reactive<FormShape>(blank())
const errors = reactive<{ title?: string; year?: string }>({})
const submitting = ref(false)

// --- Autocompletado con catálogos externos (TMDB, Google Books, RAWG, iTunes) ---

const suggestions = ref<ExternalSearchResult[]>([])
const showSuggestions = ref(false)
const searching = ref(false)
const searchAvailable = ref(true)
let suppressNextSearch = false
let searchTimeout: ReturnType<typeof setTimeout> | undefined

async function runSearch(query: string) {
  const q = query.trim()
  if (q.length < 2) {
    suggestions.value = []
    return
  }
  searching.value = true
  try {
    const res = await searchService.search(form.type, q)
    suggestions.value = res.results
    searchAvailable.value = res.available
  } catch {
    suggestions.value = []
    searchAvailable.value = true
  } finally {
    searching.value = false
  }
}

// Rellena el formulario cuando cambia la obra en edición (o lo limpia en alta).
// `watch` (no `watchEffect`) a propósito: sólo debe depender de `editing`,
// nunca de `form.title` — si no, cada tecla que el usuario escribe dispara
// este handler y `Object.assign(form, blank())` borra lo que acaba de teclear.
watch(
  editing,
  (e) => {
    suppressNextSearch = true
    if (e) {
      Object.assign(form, {
        type: e.type,
        title: e.title,
        creator: e.creator,
        year: e.year != null ? String(e.year) : '',
        status: e.status,
        rating: e.rating ?? 0,
        progress: e.progress ?? 0,
        favorite: e.favorite,
        genres: e.genres.join(', '),
        cover: e.cover ?? '',
        notes: e.notes,
      })
    } else {
      Object.assign(form, blank())
    }
    errors.title = undefined
    errors.year = undefined
    suggestions.value = []
    showSuggestions.value = false
  },
  { immediate: true },
)

const creatorLabel = computed(() => typeMeta(form.type).creatorLabel)
const showProgress = computed(() => form.status === 'in-progress')

watch(
  () => form.title,
  (value) => {
    if (suppressNextSearch) {
      suppressNextSearch = false
      return
    }
    showSuggestions.value = true
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => runSearch(value), 400)
  },
)

watch(
  () => form.type,
  () => {
    if (form.title.trim().length >= 2) void runSearch(form.title)
  },
)

function applySuggestion(s: ExternalSearchResult) {
  suppressNextSearch = true
  form.title = s.title
  if (s.creator) form.creator = s.creator
  if (s.year != null) form.year = String(s.year)
  if (s.genres.length) form.genres = s.genres.join(', ')
  if (s.cover) form.cover = s.cover
  showSuggestions.value = false
  suggestions.value = []
}

function validate(): boolean {
  errors.title = form.title.trim() ? undefined : 'El título es obligatorio.'
  const year = form.year.trim()
  errors.year =
    !year || (/^\d{3,4}$/.test(year) && +year >= 1800 && +year <= new Date().getFullYear() + 1)
      ? undefined
      : 'Escribe un año válido (ej. 1999).'
  return !errors.title && !errors.year
}

function toInput(): MediaEntryInput {
  const genres = form.genres
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
  return {
    type: form.type,
    title: form.title.trim(),
    creator: form.creator.trim(),
    year: form.year.trim() ? Number(form.year) : null,
    status: form.status,
    rating: form.rating > 0 ? form.rating : null,
    progress: form.status === 'in-progress' ? form.progress : null,
    favorite: form.favorite,
    genres,
    cover: form.cover.trim() || null,
    notes: form.notes.trim(),
  }
}

async function submit() {
  if (!validate() || submitting.value) return
  submitting.value = true
  try {
    if (editing.value) {
      await media.editEntry(editing.value.id, toInput())
    } else {
      await media.addEntry(toInput())
    }
    closeAnimated()
  } catch (e) {
    errors.title = e instanceof Error ? e.message : 'No se pudo guardar.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
     ref="modalRef"
    :title="editing ? 'Editar obra' : 'Nueva obra'"
    size="lg"
    @close="ui.closeModal()"
  >
    <form class="entry-form" @submit.prevent="submit">
      <div class="entry-form__row">
        <AppField v-slot="{ id }" label="Tipo">
          <select :id="id" v-model="form.type" class="app-select">
            <option v-for="t in MEDIA_TYPES" :key="t.value" :value="t.value">
              {{ t.label }}
            </option>
          </select>
        </AppField>

        <AppField v-slot="{ id }" label="Estado">
          <select :id="id" v-model="form.status" class="app-select">
            <option v-for="s in MEDIA_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </AppField>
      </div>

      <AppField v-slot="{ id }" label="Título" :error="errors.title">
        <div class="entry-form__autocomplete">
          <input
            :id="id"
            v-model="form.title"
            class="app-input"
            autocomplete="off"
            @focus="showSuggestions = true"
            @blur="showSuggestions = false"
          />
          <ul v-if="showSuggestions && form.title.trim().length >= 2" class="entry-form__suggestions">
            <li v-if="searching" class="entry-form__suggestion entry-form__suggestion--hint">Buscando…</li>
            <template v-else-if="suggestions.length">
              <li v-for="s in suggestions" :key="s.externalId">
                <button type="button" class="entry-form__suggestion" @mousedown.prevent="applySuggestion(s)">
                  <img v-if="s.cover" :src="s.cover" alt="" class="entry-form__suggestion-cover" />
                  <span class="entry-form__suggestion-text">
                    <span class="entry-form__suggestion-title">{{ s.title }}</span>
                    <span class="entry-form__suggestion-meta">{{ [s.creator, s.year].filter(Boolean).join(' · ') }}</span>
                  </span>
                </button>
              </li>
            </template>
            <li v-else-if="!searchAvailable" class="entry-form__suggestion entry-form__suggestion--hint">
              Búsqueda automática no configurada para este tipo.
            </li>
            <li v-else class="entry-form__suggestion entry-form__suggestion--hint">Sin coincidencias.</li>
          </ul>
        </div>
      </AppField>

      <div class="entry-form__row">
        <AppField v-slot="{ id }" :label="creatorLabel">
          <input :id="id" v-model="form.creator" class="app-input" autocomplete="off" />
        </AppField>

        <AppField v-slot="{ id }" label="Año" :error="errors.year" hint="Opcional">
          <input :id="id" v-model="form.year" class="app-input" inputmode="numeric" placeholder="1999" />
        </AppField>
      </div>

      <div class="entry-form__row">
        <AppField label="Calificación">
          <RatingStars :value="form.rating" editable @update:value="form.rating = $event" />
        </AppField>

        <AppField v-if="showProgress" v-slot="{ id }" label="Progreso">
          <div class="entry-form__progress">
            <input
              :id="id"
              v-model.number="form.progress"
              type="range"
              min="0"
              max="100"
              step="5"
              class="entry-form__range"
            />
            <span class="entry-form__progress-value">{{ form.progress }}%</span>
          </div>
        </AppField>
      </div>

      <AppField v-slot="{ id }" label="Géneros" hint="Sepáralos con comas">
        <input
          :id="id"
          v-model="form.genres"
          class="app-input"
          placeholder="Sci-Fi, Drama, Noir"
          autocomplete="off"
        />
      </AppField>

      <AppField v-slot="{ id }" label="Portada (URL)" hint="Opcional">
        <input :id="id" v-model="form.cover" class="app-input" placeholder="https://..." autocomplete="off" />
      </AppField>

      <AppField v-slot="{ id }" label="Notas" hint="Opcional">
        <textarea :id="id" v-model="form.notes" class="app-textarea" />
      </AppField>

      <label class="entry-form__check">
        <input v-model="form.favorite" type="checkbox" />
        Marcar como favorita
      </label>
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="closeAnimated">Cancelar</BaseButton>
      <BaseButton :disabled="submitting" @click="submit">
        {{ submitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar obra' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.entry-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.entry-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.entry-form__autocomplete {
  position: relative;
}

.entry-form__suggestions {
  position: absolute;
  z-index: 10;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  margin: 0;
  padding: var(--space-xs);
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  max-height: 280px;
  overflow-y: auto;
}

.entry-form__suggestion {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-xs) var(--space-sm);
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.entry-form__suggestion:hover {
  background: var(--color-surface-2);
}

.entry-form__suggestion--hint {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  cursor: default;
}

.entry-form__suggestion--hint:hover {
  background: none;
}

.entry-form__suggestion-cover {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  flex-shrink: 0;
}

.entry-form__suggestion-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.entry-form__suggestion-title {
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-form__suggestion-meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.entry-form__progress {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.entry-form__range {
  flex: 1;
  accent-color: var(--color-accent);
}

.entry-form__progress-value {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  min-width: 3ch;
  text-align: right;
}

.entry-form__check {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.875rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.entry-form__check input {
  accent-color: var(--color-accent);
}

@media (max-width: 520px) {
  .entry-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
