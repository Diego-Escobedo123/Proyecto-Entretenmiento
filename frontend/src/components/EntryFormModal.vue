<script setup lang="ts">
/**
 * EntryFormModal — alta y edición de una obra. Se controla desde `useUiStore`:
 * si `editingEntryId` es null es alta, si trae id es edición.
 * Escribe a través de `useMediaStore` (que a su vez usa el servicio).
 */
import { computed, reactive, ref, watchEffect } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import AppField from './AppField.vue'
import RatingStars from './RatingStars.vue'
import { MEDIA_STATUSES, MEDIA_TYPES, typeMeta } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'
import type { MediaEntryInput, MediaStatus, MediaType } from '../types/media'

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

// Rellena el formulario cuando cambia la obra en edición (o lo limpia en alta).
watchEffect(() => {
  const e = editing.value
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
})

const creatorLabel = computed(() => typeMeta(form.type).creatorLabel)
const showProgress = computed(() => form.status === 'in-progress')

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
        <input :id="id" v-model="form.title" class="app-input" autocomplete="off" />
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
