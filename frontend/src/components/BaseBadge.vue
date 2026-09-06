<script setup lang="ts">
/**
 * BaseBadge — etiqueta pequeña de tipo de contenido (Movie, Book, Game...)
 * Uso: <BaseBadge>Movie</BaseBadge>  <BaseBadge variant="accent">Book</BaseBadge>
 */
withDefaults(defineProps<{
  variant?: 'default' | 'accent'
}>(), {
  variant: 'default',
})
</script>

<template>
  <span class="base-badge" :class="`base-badge--${variant}`">
    <slot />
  </span>
</template>

<style scoped>
.base-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: rgba(243, 231, 216, 0.1);
  color: var(--color-text);
}

.base-badge--accent {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}
</style>
