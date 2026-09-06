<script setup lang="ts">
/**
 * BaseTag — chip para géneros y filtros.
 * Si es `clickable` (default) se renderiza como <button> real: foco y teclado
 * gratis. Si no, es un <span> decorativo.
 * Uso:
 *   <BaseTag>Sci-Fi</BaseTag>
 *   <BaseTag :active="isActive" @click="toggle">Jazz</BaseTag>
 *   <BaseTag :clickable="false">solo lectura</BaseTag>
 */
withDefaults(defineProps<{ active?: boolean; clickable?: boolean }>(), {
  active: false,
  clickable: true,
})

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    v-if="clickable"
    type="button"
    class="base-tag base-tag--clickable"
    :class="{ 'base-tag--active': active }"
    :aria-pressed="active"
    @click="$emit('click')"
  >
    <slot />
  </button>
  <span v-else class="base-tag" :class="{ 'base-tag--active': active }">
    <slot />
  </span>
</template>

<style scoped>
.base-tag {
  display: inline-flex;
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.base-tag--clickable {
  cursor: pointer;
}

.base-tag--clickable:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.base-tag--active {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  border-color: var(--color-accent);
}
</style>
