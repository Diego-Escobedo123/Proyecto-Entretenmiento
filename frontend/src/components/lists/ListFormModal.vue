<script setup lang="ts">
/**
 * ListFormModal — crear o editar una lista (portada, nombre, descripción,
 * pública, con ranking). Emite `saved` con el resumen que devuelve el backend.
 *
 * Portada: la automática es un collage de las portadas de las primeras obras
 * (`previewCovers`, sólo para mostrarla aquí). Se puede subir una imagen
 * propia: se recorta al centro en un cuadrado de 480 × 480 en el navegador y
 * se guarda incrustada, como la foto de perfil. "Usar automática" la quita.
 *
 * Uso:
 *   <ListFormModal v-if="open" @close="open = false" @saved="onSaved" />
 *   <ListFormModal v-if="open" :list="lista" :preview-covers="portadas" @close="…" @saved="…" />   (edición)
 */
import { reactive, ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import BaseButton from '../BaseButton.vue'
import BaseIcon from '../BaseIcon.vue'
import AppField from '../AppField.vue'
import { listService } from '../../services/listService'
import { ACCEPTED_IMAGE_TYPES, toSquareDataUrl } from '../../lib/image'
import type { ListSummary } from '../../types/list'

const props = defineProps<{
  list?: Pick<ListSummary, 'id' | 'title' | 'description' | 'isPublic' | 'ranked' | 'coverImage'>
  /** Portadas de las primeras obras, para mostrar la portada automática. */
  previewCovers?: string[]
}>()
const emit = defineEmits<{ close: []; saved: [list: ListSummary] }>()

const modalRef = ref<InstanceType<typeof BaseModal> | null>(null)

const form = reactive({
  title: props.list?.title ?? '',
  description: props.list?.description ?? '',
  isPublic: props.list?.isPublic ?? false,
  ranked: props.list?.ranked ?? false,
  coverImage: props.list?.coverImage ?? (null as string | null),
})
const error = ref('')
const saving = ref(false)

// --- Portada ---
const COVER_SIZE = 480
/** El archivo original puede ser grande: se achica antes de guardarlo. */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024
const coverInput = ref<HTMLInputElement | null>(null)
const coverError = ref('')
const processingCover = ref(false)

async function onCoverFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // permite volver a elegir el mismo archivo
  coverError.value = ''
  if (!file) return
  if (!ACCEPTED_IMAGE_TYPES.test(file.type)) {
    coverError.value = 'Elige una imagen JPG, PNG o WebP.'
    return
  }
  if (file.size > MAX_SOURCE_BYTES) {
    coverError.value = 'La imagen pesa más de 8 MB.'
    return
  }
  processingCover.value = true
  try {
    form.coverImage = await toSquareDataUrl(file, COVER_SIZE)
  } catch {
    coverError.value = 'No se pudo leer la imagen.'
  } finally {
    processingCover.value = false
  }
}

async function submit() {
  if (!form.title.trim()) {
    error.value = 'Ponle un nombre a la lista.'
    return
  }
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    const input = { ...form, title: form.title.trim(), description: form.description.trim() }
    const saved = props.list ? await listService.update(props.list.id, input) : await listService.create(input)
    emit('saved', saved)
    modalRef.value?.requestClose()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar la lista.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal ref="modalRef" :title="list ? 'Editar lista' : 'Nueva lista'" @close="emit('close')">
    <form class="list-form" @submit.prevent="submit">
      <!-- Portada: la propia o la automática (collage de las primeras obras) -->
      <div class="list-form__cover">
        <div class="list-form__cover-preview" :class="{ 'is-custom': form.coverImage }">
          <img v-if="form.coverImage" :src="form.coverImage" alt="Portada de la lista" />
          <div
            v-else-if="previewCovers?.length"
            class="list-form__collage"
            :class="`list-form__collage--${Math.min(previewCovers.length, 4)}`"
          >
            <img v-for="c in previewCovers.slice(0, 4)" :key="c" :src="c" alt="" />
          </div>
          <BaseIcon v-else name="card-list" class="list-form__cover-icon" />
        </div>

        <div class="list-form__cover-info">
          <strong>Portada</strong>
          <small>
            {{ form.coverImage ? 'Tu imagen, recortada en cuadrado.' : 'Automática: las portadas de las primeras obras.' }}
          </small>
          <div class="list-form__cover-actions">
            <button type="button" class="list-form__cover-btn" :disabled="processingCover" @click="coverInput?.click()">
              <BaseIcon name="image" />
              {{ processingCover ? 'Procesando…' : form.coverImage ? 'Cambiar imagen' : 'Subir imagen' }}
            </button>
            <button
              v-if="form.coverImage"
              type="button"
              class="list-form__cover-btn list-form__cover-btn--ghost"
              @click="form.coverImage = null"
            >
              <BaseIcon name="grid-fill" /> Usar automática
            </button>
          </div>
          <p v-if="coverError" class="list-form__cover-error" role="alert">{{ coverError }}</p>
        </div>

        <input
          ref="coverInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="list-form__file"
          tabindex="-1"
          aria-hidden="true"
          @change="onCoverFile"
        />
      </div>

      <AppField v-slot="{ id }" label="Nombre" :error="error || undefined">
        <input
          :id="id"
          v-model="form.title"
          class="app-input"
          maxlength="100"
          placeholder="Para ver en vacaciones, Mis 10 libros favoritos…"
          autocomplete="off"
        />
      </AppField>

      <AppField v-slot="{ id }" label="Descripción" hint="Opcional">
        <textarea
          :id="id"
          v-model="form.description"
          class="app-textarea"
          maxlength="1000"
          placeholder="¿De qué va esta lista?"
        />
      </AppField>

      <div class="list-form__options">
        <label class="list-form__option">
          <input v-model="form.isPublic" type="checkbox" />
          <span>
            <strong><BaseIcon :name="form.isPublic ? 'globe' : 'lock-fill'" /> Pública</strong>
            <small>La verá cualquiera con el enlace y aparecerá en tu perfil.</small>
          </span>
        </label>
        <label class="list-form__option">
          <input v-model="form.ranked" type="checkbox" />
          <span>
            <strong><BaseIcon name="sort-numeric-down" /> Con ranking</strong>
            <small>El orden importa: las obras se muestran numeradas.</small>
          </span>
        </label>
      </div>
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="modalRef?.requestClose()">Cancelar</BaseButton>
      <BaseButton :disabled="saving" @click="submit">{{ list ? 'Guardar cambios' : 'Crear lista' }}</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.list-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* --- Portada --- */

.list-form__cover {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.list-form__cover-preview {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 104px;
  height: 104px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.list-form__cover-preview > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: mosaic-fade-up var(--dur-base) var(--ease-out);
}

.list-form__cover-icon {
  font-size: 2rem;
  color: var(--color-text-subtle);
}

/* Collage automático (como en ListCard). */
.list-form__collage {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  width: 100%;
  height: 100%;
}

.list-form__collage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.list-form__collage--1 {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.list-form__collage--2 {
  grid-template-rows: 1fr;
}

.list-form__collage--3 img:first-child {
  grid-row: span 2;
}

.list-form__cover-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-form__cover-info strong {
  font-size: 0.875rem;
  color: var(--color-text);
}

.list-form__cover-info small {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.list-form__cover-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: 4px;
}

.list-form__cover-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--color-accent);
  border-radius: 999px;
  background: none;
  color: var(--color-accent);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--dur-fast) ease, transform var(--dur-fast) ease;
}

.list-form__cover-btn:hover:not(:disabled) {
  background: var(--color-accent-bg);
}

.list-form__cover-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.list-form__cover-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.list-form__cover-btn--ghost {
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.list-form__cover-error {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-danger);
}

.list-form__file {
  display: none;
}

.list-form__options {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.list-form__option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.list-form__option input {
  margin-top: 3px;
}

.list-form__option span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.list-form__option strong {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9375rem;
  color: var(--color-text);
}

.list-form__option small {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}
</style>
