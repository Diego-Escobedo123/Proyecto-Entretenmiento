<script setup lang="ts">
/**
 * SettingsModal — "Ajustes del perfil": foto, nombre, usuario, frase, cita
 * personal y si el perfil es privado.
 * Controlado desde `useUiStore`; persiste vía `useProfileStore`.
 *
 * La foto subida se recorta en el navegador a un cuadrado de 256 × 256 y se
 * guarda como imagen incrustada (data URL, unos 20–40 KB): no hace falta un
 * servidor de archivos. Una foto por enlace guardada antes se sigue mostrando
 * y se puede quitar o reemplazar. Los errores del backend llegan con su campo
 * y se muestran debajo de ese campo.
 *
 * Al final, "Eliminar cuenta": pide escribir ELIMINAR, borra la cuenta con
 * todo lo suyo (DELETE /auth/account) y manda al login.
 */
import { computed, reactive, ref, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import BaseIcon from './BaseIcon.vue'
import AppField from './AppField.vue'
import { ApiError } from '../lib/api'
import { ACCEPTED_IMAGE_TYPES, toSquareDataUrl } from '../lib/image'
import { useProfileStore } from '../stores/profile'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'

const ui = useUiStore()
const profileStore = useProfileStore()
const auth = useAuthStore()
const router = useRouter()

const modalRef = ref<InstanceType<typeof BaseModal> | null>(null)
function closeAnimated() {
  modalRef.value?.requestClose()
}

// Los mismos límites que valida el backend (routes/profile.ts).
const MAX_NAME = 40
const MAX_TAGLINE = 60
const MAX_QUOTE = 120
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const PHOTO_SIZE = 256

const form = reactive({ name: '', handle: '', tagline: '', quote: '', avatar: '', isPublic: false })
const errors = reactive<Record<string, string | undefined>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)

watchEffect(() => {
  const p = profileStore.profile
  Object.assign(form, {
    name: p.name,
    handle: p.handle,
    tagline: p.tagline,
    quote: p.quote,
    avatar: p.avatar ?? '',
    isPublic: p.isPublic,
  })
})

const initial = computed(() => (form.name.trim() || '?').charAt(0).toUpperCase())

// --- Foto ---
const fileInput = ref<HTMLInputElement | null>(null)
const processing = ref(false)

function pickFile() {
  fileInput.value?.click()
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // permite volver a elegir el mismo archivo
  errors.avatar = undefined
  if (!file) return
  if (!ACCEPTED_IMAGE_TYPES.test(file.type)) {
    errors.avatar = 'Elige una imagen JPG, PNG o WebP.'
    return
  }
  if (file.size > MAX_PHOTO_BYTES) {
    errors.avatar = 'La imagen pesa más de 2 MB.'
    return
  }
  processing.value = true
  try {
    form.avatar = await toSquareDataUrl(file, PHOTO_SIZE)
  } catch {
    errors.avatar = 'No se pudo leer la imagen.'
  } finally {
    processing.value = false
  }
}

function removePhoto() {
  form.avatar = ''
  errors.avatar = undefined
}

// --- Guardar ---
/** Quita las comillas que se hayan escrito: las pone el perfil. */
const cleanQuote = (text: string) => text.trim().replace(/^["“”'«»]+|["“”'«»]+$/g, '').trim()

async function save() {
  if (submitting.value) return
  for (const key of Object.keys(errors)) errors[key] = undefined
  formError.value = null
  if (!form.name.trim()) {
    errors.name = 'Escribe tu nombre.'
    return
  }
  submitting.value = true
  try {
    await profileStore.updateProfile({
      name: form.name.trim(),
      handle: form.handle.trim().replace(/^@/, '').toLowerCase(),
      tagline: form.tagline.trim(),
      quote: cleanQuote(form.quote),
      avatar: form.avatar.trim() || null,
      isPublic: form.isPublic,
    })
    closeAnimated()
  } catch (e) {
    if (e instanceof ApiError && e.field) errors[e.field] = e.message
    else formError.value = e instanceof Error ? e.message : 'No se pudo guardar.'
  } finally {
    submitting.value = false
  }
}

// --- Eliminar cuenta ---
const DELETE_WORD = 'ELIMINAR'
const deleteOpen = ref(false)
const deleteConfirm = ref('')
const deleting = ref(false)
const deleteError = ref<string | null>(null)
const canDelete = computed(() => deleteConfirm.value.trim() === DELETE_WORD && !deleting.value)

function toggleDelete() {
  deleteOpen.value = !deleteOpen.value
  deleteConfirm.value = ''
  deleteError.value = null
}

async function deleteAccount() {
  if (!canDelete.value) return
  deleting.value = true
  deleteError.value = null
  const result = await auth.deleteAccount()
  deleting.value = false
  if (!result.ok) {
    deleteError.value = result.message
    return
  }
  ui.closeModal()
  router.push('/login')
}
</script>

<template>
  <BaseModal ref="modalRef" title="Ajustes del perfil" size="lg" @close="ui.closeModal()">
    <form class="settings" @submit.prevent="save">
      <!-- Foto de perfil -->
      <div class="settings__photo">
        <div class="settings__avatar" aria-hidden="true">
          <img v-if="form.avatar" :src="form.avatar" alt="" @error="errors.avatar = 'No se pudo cargar esa imagen.'" />
          <span v-else>{{ initial }}</span>
        </div>
        <div class="settings__photo-body">
          <span class="settings__label">Foto de perfil</span>
          <div class="settings__photo-actions">
            <button type="button" class="settings__btn settings__btn--solid" :disabled="processing" @click="pickFile">
              <BaseIcon name="upload" /> {{ processing ? 'Procesando…' : 'Subir foto' }}
            </button>
            <button v-if="form.avatar" type="button" class="settings__remove" @click="removePhoto">Quitar</button>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="settings__file"
            tabindex="-1"
            aria-hidden="true"
            @change="onFile"
          />
          <p v-if="errors.avatar" class="settings__error">{{ errors.avatar }}</p>
          <p v-else class="settings__hint">JPG o PNG, cuadrada, hasta 2 MB</p>
        </div>
      </div>

      <!-- Nombre y usuario -->
      <div class="settings__row">
        <AppField v-slot="{ id }" label="Nombre" :error="errors.name">
          <input :id="id" v-model="form.name" class="app-input" :maxlength="MAX_NAME" autocomplete="name" />
        </AppField>
        <AppField v-slot="{ id }" label="Usuario" :error="errors.handle">
          <div class="settings__handle">
            <BaseIcon name="at" class="settings__handle-icon" />
            <input
              :id="id"
              v-model="form.handle"
              class="app-input settings__handle-input"
              maxlength="30"
              autocomplete="username"
              spellcheck="false"
            />
          </div>
        </AppField>
      </div>

      <!-- Frase -->
      <div class="settings__field">
        <AppField v-slot="{ id }" label="Frase" :error="errors.tagline">
          <input
            :id="id"
            v-model="form.tagline"
            class="app-input"
            :maxlength="MAX_TAGLINE"
            placeholder="Ciencia ficción, jazz y RPGs largos"
            autocomplete="off"
          />
        </AppField>
        <p v-if="!errors.tagline" class="settings__meta">
          <span>Aparece bajo tu nombre</span>
          <span>{{ form.tagline.length }} / {{ MAX_TAGLINE }}</span>
        </p>
      </div>

      <!-- Cita personal: las comillas son decorativas -->
      <div class="settings__field">
        <AppField v-slot="{ id }" label="Cita personal" :error="errors.quote">
          <div class="settings__quote">
            <span class="settings__quote-mark settings__quote-mark--open" aria-hidden="true">“</span>
            <textarea
              :id="id"
              v-model="form.quote"
              class="app-textarea settings__quote-input"
              rows="2"
              :maxlength="MAX_QUOTE"
              placeholder="Una frase de un libro, película o canción"
            />
            <span class="settings__quote-mark settings__quote-mark--close" aria-hidden="true">”</span>
          </div>
        </AppField>
        <p v-if="!errors.quote" class="settings__meta">
          <span>Opcional · las comillas se agregan solas</span>
          <span>{{ form.quote.length }} / {{ MAX_QUOTE }}</span>
        </p>
      </div>

      <!-- Privacidad -->
      <div class="settings__privacy">
        <span class="settings__privacy-icon" aria-hidden="true">
          <BaseIcon :name="form.isPublic ? 'globe' : 'lock'" />
        </span>
        <div class="settings__privacy-text">
          <span class="settings__privacy-title">Perfil privado</span>
          <span class="settings__privacy-hint">
            <template v-if="form.isPublic">
              Ahora cualquiera ve tu colección, tu diario y tu ADN cultural.
            </template>
            <template v-else>Solo tú y quienes aceptes ven tu colección, tu diario y tu ADN cultural.</template>
          </span>
        </div>
        <button
          type="button"
          class="settings__switch"
          role="switch"
          :aria-checked="!form.isPublic"
          aria-label="Perfil privado"
          @click="form.isPublic = !form.isPublic"
        >
          <span class="settings__switch-thumb" />
        </button>
      </div>

      <p v-if="formError" class="settings__error" role="alert">{{ formError }}</p>

      <!-- Eliminar cuenta -->
      <div class="settings__danger">
        <div class="settings__danger-head">
          <div class="settings__privacy-text">
            <span class="settings__privacy-title">Eliminar cuenta</span>
            <span class="settings__privacy-hint">
              Se borran tu perfil, tu colección, tu diario, tus listas y tus seguidores. No se puede deshacer.
            </span>
          </div>
          <button type="button" class="settings__btn settings__btn--danger-outline" @click="toggleDelete">
            {{ deleteOpen ? 'Cancelar' : 'Eliminar…' }}
          </button>
        </div>

        <div v-if="deleteOpen" class="settings__danger-confirm">
          <AppField v-slot="{ id }" :label="`Escribe ${DELETE_WORD} para confirmar`" :error="deleteError ?? undefined">
            <input
              :id="id"
              v-model="deleteConfirm"
              class="app-input"
              autocomplete="off"
              spellcheck="false"
              @keydown.enter.prevent="deleteAccount"
            />
          </AppField>
          <button type="button" class="settings__btn settings__btn--danger" :disabled="!canDelete" @click="deleteAccount">
            {{ deleting ? 'Eliminando…' : 'Eliminar mi cuenta' }}
          </button>
        </div>
      </div>
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="closeAnimated">Cancelar</BaseButton>
      <BaseButton :disabled="submitting || processing" @click="save">
        {{ submitting ? 'Guardando…' : 'Guardar cambios' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.settings__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.settings__hint,
.settings__meta {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.settings__error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-danger);
}

/* --- Foto --- */
.settings__photo {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

/* Doble anillo dorado, como el avatar de la cabecera. */
.settings__avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-family: var(--font-serif);
  font-size: 2.5rem;
  font-weight: 900;
  box-shadow:
    inset 0 0 0 4px var(--color-surface),
    0 0 0 4px var(--color-accent);
}

.settings__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.settings__photo-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.settings__photo-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.settings__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
}

.settings__btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.settings__btn--solid {
  border: 1px solid var(--fig-cream);
  background: var(--fig-cream);
  color: var(--fig-purple);
}

.settings__btn--solid:hover:not(:disabled) {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.settings__remove {
  padding: 0 4px;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-decoration: underline;
  cursor: pointer;
}

.settings__remove:hover {
  color: var(--color-danger);
}

.settings__file {
  display: none;
}

/* --- Nombre | Usuario --- */
.settings__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.settings__handle {
  position: relative;
}

.settings__handle-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.settings__handle-input {
  padding-left: 34px;
}

/* --- Frase y cita: contador a la derecha --- */
.settings__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.settings__meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-sm);
}

.settings__quote {
  position: relative;
}

.settings__quote-input {
  min-height: 84px;
  padding: 14px 44px 14px 44px;
  font-family: var(--font-serif);
  font-size: 1.0625rem;
  font-style: italic;
  resize: vertical;
}

.settings__quote-mark {
  position: absolute;
  font-family: var(--font-serif);
  font-size: 2.5rem;
  font-weight: 900;
  line-height: 1;
  color: var(--deep-raspberry);
  pointer-events: none;
}

.settings__quote-mark--open {
  top: 8px;
  left: 12px;
}

.settings__quote-mark--close {
  right: 12px;
  bottom: -2px;
}

/* --- Perfil privado --- */
.settings__privacy {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--color-bg);
}

.settings__privacy-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font-size: 1.125rem;
}

.settings__privacy-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings__privacy-title {
  font-weight: 800;
  color: var(--color-text);
}

.settings__privacy-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.settings__switch {
  flex-shrink: 0;
  position: relative;
  width: 52px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-2);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.settings__switch[aria-checked='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.settings__switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-text-muted);
  transition: transform 0.15s ease, background 0.15s ease;
}

.settings__switch[aria-checked='true'] .settings__switch-thumb {
  transform: translateX(22px);
  background: var(--color-accent-contrast);
}

/* --- Eliminar cuenta --- */
.settings__danger {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-lg);
}

.settings__danger-head {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.settings__danger-confirm {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
}

.settings__danger-confirm > :first-child {
  flex: 1;
  min-width: 0;
}

.settings__btn--danger-outline {
  flex-shrink: 0;
  border: 1px solid var(--color-danger);
  background: none;
  color: var(--color-danger);
}

.settings__btn--danger-outline:hover {
  background: var(--color-danger);
  color: var(--fig-cream);
}

.settings__btn--danger {
  flex-shrink: 0;
  border: 1px solid var(--color-danger);
  background: var(--color-danger);
  color: var(--fig-cream);
}

@media (max-width: 560px) {
  .settings__danger-head,
  .settings__danger-confirm {
    flex-direction: column;
    align-items: stretch;
  }

  .settings__photo {
    flex-direction: column;
    align-items: flex-start;
  }

  .settings__row {
    grid-template-columns: 1fr;
  }
}
</style>
