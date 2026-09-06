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

const form = reactive({ name: '', handle: '', tagline: '', quote: '', avatar: '' })
const submitting = ref(false)

watchEffect(() => {
  const p = profileStore.profile
  Object.assign(form, {
    name: p.name,
    handle: p.handle,
    tagline: p.tagline,
    quote: p.quote,
    avatar: p.avatar ?? '',
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
    })
    ui.closeModal()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal title="Ajustes del perfil" @close="ui.closeModal()">
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
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="ui.closeModal()">Cancelar</BaseButton>
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
</style>
