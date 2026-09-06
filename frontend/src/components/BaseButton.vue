<script setup lang="ts">
/**
 * BaseButton — botón primario/outline reutilizable.
 * Uso:
 *   <BaseButton>Add Entry</BaseButton>
 *   <BaseButton variant="outline">Apply Filters</BaseButton>
 */
withDefaults(defineProps<{
  variant?: 'primary' | 'outline' | 'ghost'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'primary',
  disabled: false,
  type: 'button',
})

defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <button
    class="base-button"
    :class="`base-button--${variant}`"
    :type="type"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot name="icon" />
    <slot />
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: 10px var(--space-md);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-button--primary {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}
.base-button--primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.base-button--outline {
  background: transparent;
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.base-button--outline:hover:not(:disabled) {
  background: var(--color-accent-bg);
}

.base-button--ghost {
  background: transparent;
  color: var(--color-text-muted);
}
.base-button--ghost:hover:not(:disabled) {
  color: var(--color-text);
}
</style>
