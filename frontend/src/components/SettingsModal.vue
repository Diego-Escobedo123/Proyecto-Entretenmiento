<script setup lang="ts">
/**
 * SettingsModal — edición del perfil del usuario (nombre, handle, frase).
 * Controlado desde `useUiStore`; persiste vía `useProfileStore`.
 */
import { reactive, ref, watchEffect } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import AppField from './AppField.vue'
import { useProfileStore } from '../stores/profile'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const profileStore = useProfileStore()

const modalRef = ref<InstanceType<typeof BaseModal> | null>(null)
function closeAnimated() {
  modalRef.value?.requestClose()
}

const form = reactive({ name: '', handle: '', tagline: '', quote: '', avatar: '', isPublic: false })
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

async function save() {
  if (submitting.value) return
  submitting.value = true
  try {
    await profileStore.updateProfile({
      name: form.name.trim() || 'Tu perfil',
      handle: form.handle.trim().replace(/^@/, ''),
      tagline: form.tagline.trim(),
      quote: form.quote.trim(),
      avatar: form.avatar.trim() || null,
      isPublic: form.isPublic,
    })
    closeAnimated()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
    <BaseModal ref="modalRef" title="Ajustes del perfil" @close="ui.closeModal()">
    <form class="settings-form" @submit.prevent="save">
      <AppField v-slot="{ id }" label="Nombre">
        <input :id="id" v-model="form.name" class="app-input" autocomplete="off" />
      </AppField>
      <AppField v-slot="{ id }" label="Usuario" hint="Sin @">
        <input :id="id" v-model="form.handle" class="app-input" autocomplete="off" />
      </AppField>
      <AppField v-slot="{ id }" label="Frase" hint="Aparece en tu perfil">
        <input :id="id" v-model="form.tagline" class="app-input" autocomplete="off" />
      </AppField>
      <AppField v-slot="{ id }" label="Cita personal">
        <input :id="id" v-model="form.quote" class="app-input" autocomplete="off" />
      </AppField>
      <AppField v-slot="{ id }" label="Avatar (URL)" hint="Opcional">
        <input :id="id" v-model="form.avatar" class="app-input" placeholder="https://..." autocomplete="off" />
      </AppField>

      <div class="settings-visibility">
        <div class="settings-visibility__text">
          <span class="settings-visibility__label">Perfil público</span>
          <span class="settings-visibility__hint">
            Guarda tu preferencia. Por ahora no existe una vista pública que otros puedan ver.
          </span>
        </div>
        <button
          type="button"
          class="settings-visibility__switch"
          role="switch"
          :aria-checked="form.isPublic"
          @click="form.isPublic = !form.isPublic"
        >
          <span class="settings-visibility__switch-thumb" />
        </button>
      </div>
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="closeAnimated">Cancelar</BaseButton>
      <BaseButton :disabled="submitting" @click="save">
        {{ submitting ? 'Guardando…' : 'Guardar' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.settings-visibility {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.settings-visibility__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-visibility__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.settings-visibility__hint {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  line-height: 1.4;
}

.settings-visibility__switch {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
  position: relative;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.settings-visibility__switch[aria-checked='true'] {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.settings-visibility__switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-surface);
  transition: transform 0.15s ease;
}

.settings-visibility__switch[aria-checked='true'] .settings-visibility__switch-thumb {
  transform: translateX(18px);
  background: var(--color-accent-contrast);
}
</style>