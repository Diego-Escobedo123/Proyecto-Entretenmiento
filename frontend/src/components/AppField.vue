<script setup lang="ts">
/**
 * AppField — envoltorio de campo de formulario: label + slot del control + error.
 * Genera un id y lo expone al slot para enlazar <label for> con el input.
 * Uso:
 *   <AppField v-slot="{ id }" label="Título" :error="errors.title">
 *     <input :id="id" v-model="form.title" class="app-input" />
 *   </AppField>
 */
import { useId } from 'vue'

defineProps<{ label: string; error?: string; hint?: string }>()

const id = useId()
</script>

<template>
  <div class="app-field">
    <label class="app-field__label" :for="id">{{ label }}</label>
    <slot :id="id" />
    <p v-if="hint && !error" class="app-field__hint">{{ hint }}</p>
    <p v-if="error" class="app-field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.app-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.app-field__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.app-field__hint {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  margin: 0;
}

.app-field__error {
  font-size: 0.75rem;
  color: var(--color-danger);
  margin: 0;
}

/* Los estilos de .app-input / .app-select / .app-textarea viven en style.css
   para que también apliquen a controles fuera de un AppField. */
</style>
