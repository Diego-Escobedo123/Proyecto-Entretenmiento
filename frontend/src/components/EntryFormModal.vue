<script setup lang="ts">
/**
 * EntryFormModal — alta y edición de una obra. Se controla desde `useUiStore`:
 * si `editingEntryId` es null es alta, si trae id es edición.
 * Escribe a través de `useMediaStore` (que a su vez usa el servicio).
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import BaseIcon from './BaseIcon.vue'
import AppField from './AppField.vue'
import RatingStars from './RatingStars.vue'
import CommunityReviews from './CommunityReviews.vue'
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
  externalId: string | null
  review: string
  notes: string
  notesPublic: boolean
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
    externalId: null,
    review: '',
    notes: '',
    notesPublic: false,
  }
}

const form = reactive<FormShape>(blank())
const errors = reactive<{ title?: string; year?: string }>({})
const submitting = ref(false)

// --- Datos de la obra vs. datos del usuario ---
// Tipo, título, creador, año, géneros y portada son datos de la obra: vienen
// del catálogo externo y no se editan a mano. Una vez elegida la obra (o al
// editar una existente) se muestran como ficha de sólo lectura. Si la obra no
// aparece en el catálogo, `manualMode` permite capturar esos datos (sin portada).

/** true cuando la obra ya se eligió del catálogo en un alta. */
const picked = ref(false)
const manualMode = ref(false)
const workLocked = computed(() => Boolean(editing.value) || picked.value)
const titleInput = ref<HTMLInputElement | null>(null)

const genreList = computed(() =>
  form.genres
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean),
)

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
    picked.value = false
    manualMode.value = false
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
        externalId: e.externalId,
        review: e.review,
        notes: e.notes,
        notesPublic: e.notesPublic,
      })
    } else {
      Object.assign(form, blank())
      // Alta precargada desde el buscador global de la barra superior.
      const prefill = ui.entryPrefill
      if (prefill) {
        if (prefill.type) form.type = prefill.type
        if (prefill.title) form.title = prefill.title
        if (prefill.creator) form.creator = prefill.creator
        if (prefill.year != null) form.year = String(prefill.year)
        if (prefill.genres?.length) form.genres = prefill.genres.join(', ')
        if (prefill.cover) form.cover = prefill.cover
        form.externalId = prefill.externalId ?? null
        // Viene de un resultado del catálogo: la obra ya está elegida.
        picked.value = Boolean(prefill.title)
      }
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
  form.creator = s.creator
  form.year = s.year != null ? String(s.year) : ''
  form.genres = s.genres.join(', ')
  form.cover = s.cover ?? ''
  form.externalId = s.externalId
  showSuggestions.value = false
  suggestions.value = []
  picked.value = true
  manualMode.value = false
  errors.title = undefined
  errors.year = undefined
}

/** Descarta la obra elegida para buscar otra (sólo en alta). */
async function changeWork() {
  picked.value = false
  suppressNextSearch = true
  Object.assign(form, { title: '', creator: '', year: '', genres: '', cover: '', externalId: null })
  await nextTick()
  titleInput.value?.focus()
}

function enterManualMode() {
  manualMode.value = true
  form.cover = ''
  form.externalId = null
  showSuggestions.value = false
  errors.title = undefined
}

function validate(): boolean {
  if (!workLocked.value && !manualMode.value) {
    errors.title = form.title.trim()
      ? 'Selecciona la obra de la lista de resultados.'
      : 'Busca la obra por su título.'
    return false
  }
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
    externalId: form.externalId,
    review: form.review.trim(),
    notes: form.notes.trim(),
    notesPublic: form.notesPublic,
  }
}

/** El comentario acompaña a la calificación: aparece al calificar (o si ya había uno). */
const showReview = computed(() => form.rating > 0 || form.review.trim() !== '')

/** Clave de la obra para buscar las reseñas de los demás usuarios. */
const workKey = computed(() => ({ type: form.type, externalId: form.externalId, title: form.title }))

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
      <!-- Obra ya elegida (o en edición): ficha de sólo lectura con datos del catálogo -->
      <div v-if="workLocked" class="entry-form__work">
        <img v-if="form.cover" :src="form.cover" alt="" class="entry-form__work-cover" />
        <div v-else class="entry-form__work-cover entry-form__work-cover--empty" aria-hidden="true">
          <BaseIcon :name="typeMeta(form.type).icon" />
        </div>

        <div class="entry-form__work-info">
          <span class="entry-form__work-type">{{ typeMeta(form.type).label }}</span>
          <h3 class="entry-form__work-title">{{ form.title }}</h3>
          <p v-if="form.creator || form.year" class="entry-form__work-meta">
            {{ [form.creator, form.year].filter(Boolean).join(' · ') }}
          </p>
          <div v-if="genreList.length" class="entry-form__work-genres">
            <span v-for="g in genreList" :key="g" class="entry-form__work-genre">{{ g }}</span>
          </div>
        </div>

        <button v-if="!editing" type="button" class="entry-form__work-change" @click="changeWork">
          Cambiar
        </button>
      </div>

      <!-- Alta: buscar la obra en el catálogo -->
      <template v-else>
        <div class="entry-form__row entry-form__row--search">
          <AppField v-slot="{ id }" label="Tipo">
            <select :id="id" v-model="form.type" class="app-select">
              <option v-for="t in MEDIA_TYPES" :key="t.value" :value="t.value">
                {{ t.label }}
              </option>
            </select>
          </AppField>

          <AppField
            v-slot="{ id }"
            label="Título"
            :error="errors.title"
            :hint="manualMode ? undefined : 'Búscala y elígela de la lista'"
          >
            <div class="entry-form__autocomplete">
              <input
                :id="id"
                ref="titleInput"
                v-model="form.title"
                class="app-input"
                autocomplete="off"
                :placeholder="manualMode ? '' : 'Escribe para buscar…'"
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
        </div>

        <!-- Respaldo: la obra no está en el catálogo (sin portada) -->
        <template v-if="manualMode">
          <div class="entry-form__row">
            <AppField v-slot="{ id }" :label="creatorLabel">
              <input :id="id" v-model="form.creator" class="app-input" autocomplete="off" />
            </AppField>

            <AppField v-slot="{ id }" label="Año" :error="errors.year" hint="Opcional">
              <input :id="id" v-model="form.year" class="app-input" inputmode="numeric" placeholder="1999" />
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
        </template>
        <button v-else type="button" class="entry-form__manual-link" @click="enterManualMode">
          ¿No aparece? Ingrésala manualmente
        </button>
      </template>

      <!-- Datos del usuario sobre la obra -->
      <div class="entry-form__row">
        <AppField v-slot="{ id }" label="Estado">
          <select :id="id" v-model="form.status" class="app-select">
            <option v-for="s in MEDIA_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </AppField>

        <AppField label="Calificación">
          <RatingStars :value="form.rating" editable @update:value="form.rating = $event" />
        </AppField>
      </div>

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

      <!-- Comentario público: acompaña a la calificación -->
      <Transition name="entry-form-reveal">
        <AppField
          v-if="showReview"
          v-slot="{ id }"
          label="Tu reseña"
          hint="Pública: la verán quienes busquen esta obra"
        >
          <textarea
            :id="id"
            v-model="form.review"
            class="app-textarea entry-form__review"
            maxlength="1000"
            placeholder="¿Qué te pareció? Cuéntale a la comunidad…"
          />
        </AppField>
      </Transition>

      <!-- Notas: privadas por defecto; si son públicas sólo se ven en el perfil -->
      <AppField v-slot="{ id }" label="Notas personales" hint="Opcional">
        <textarea
          :id="id"
          v-model="form.notes"
          class="app-textarea"
          :placeholder="form.notesPublic ? 'Se verán en tu perfil público…' : 'Sólo tú las verás…'"
        />
      </AppField>
      <div class="entry-form__visibility">
        <button
          type="button"
          class="entry-form__visibility-option"
          :class="{ 'is-active': !form.notesPublic }"
          :aria-pressed="!form.notesPublic"
          @click="form.notesPublic = false"
        >
          <BaseIcon name="lock-fill" /> Privadas
        </button>
        <button
          type="button"
          class="entry-form__visibility-option"
          :class="{ 'is-active': form.notesPublic }"
          :aria-pressed="form.notesPublic"
          @click="form.notesPublic = true"
        >
          <BaseIcon name="globe2" /> Públicas en mi perfil
        </button>
      </div>

      <label class="entry-form__check">
        <input v-model="form.favorite" type="checkbox" />
        Marcar como favorita
      </label>

      <!-- Reseñas de los demás (sólo cuando la obra ya está identificada) -->
      <CommunityReviews
        v-if="workLocked"
        :work="workKey"
        class="entry-form__community"
        @navigate="closeAnimated"
      />
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

.entry-form__row--search {
  grid-template-columns: minmax(120px, 1fr) 2fr;
}

.entry-form__autocomplete {
  position: relative;
}

/* Ficha de sólo lectura con los datos de la obra (vienen del catálogo). */
.entry-form__work {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.entry-form__work-cover {
  width: 72px;
  aspect-ratio: 2 / 3;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface);
}

.entry-form__work-cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-subtle);
}

.entry-form__work-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry-form__work-type {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-accent);
}

.entry-form__work-title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
}

.entry-form__work-meta {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.entry-form__work-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: var(--space-xs);
}

.entry-form__work-genre {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text-muted);
}

.entry-form__work-change {
  flex-shrink: 0;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 4px var(--space-sm);
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.entry-form__work-change:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.entry-form__manual-link {
  align-self: flex-start;
  margin-top: calc(-1 * var(--space-xs));
  background: none;
  border: none;
  padding: 0;
  color: var(--color-accent);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.entry-form__manual-link:hover {
  text-decoration: underline;
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

.entry-form__review {
  min-height: 80px;
}

.entry-form__visibility {
  display: flex;
  gap: var(--space-xs);
  margin-top: calc(-1 * var(--space-sm));
}

.entry-form__visibility-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.entry-form__visibility-option.is-active {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.entry-form__community {
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.entry-form-reveal-enter-active,
.entry-form-reveal-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.entry-form-reveal-enter-from,
.entry-form-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
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
