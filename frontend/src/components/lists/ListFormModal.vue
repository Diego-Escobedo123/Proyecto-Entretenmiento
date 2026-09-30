<script setup lang="ts">
/**
 * ListFormModal — crear o editar una lista (nombre, descripción, pública,
 * con ranking). Emite `saved` con el resumen que devuelve el backend.
 *
 * Uso:
 *   <ListFormModal v-if="open" @close="open = false" @saved="onSaved" />
 *   <ListFormModal v-if="open" :list="lista" @close="…" @saved="…" />   (edición)
 */
import { reactive, ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import BaseButton from '../BaseButton.vue'
import BaseIcon from '../BaseIcon.vue'
import AppField from '../AppField.vue'
import { listService } from '../../services/listService'
import type { ListSummary } from '../../types/list'

const props = defineProps<{
  list?: Pick<ListSummary, 'id' | 'title' | 'description' | 'isPublic' | 'ranked'>
}>()
const emit = defineEmits<{ close: []; saved: [list: ListSummary] }>()

const modalRef = ref<InstanceType<typeof BaseModal> | null>(null)

const form = reactive({
  title: props.list?.title ?? '',
  description: props.list?.description ?? '',
  isPublic: props.list?.isPublic ?? false,
  ranked: props.list?.ranked ?? false,
})
const error = ref('')
const saving = ref(false)

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
