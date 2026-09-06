<script setup lang="ts">
/**
 * EmptyState — bloque centrado para cuando una lista/sección no tiene datos.
 * Uso:
 *   <EmptyState icon="🗂️" title="Tu colección está vacía" text="Agrega tu primera obra.">
 *     <BaseButton @click="add">Agregar obra</BaseButton>
 *   </EmptyState>
 */
defineProps<{ icon?: string; title: string; text?: string; compact?: boolean }>()
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <div v-if="icon" class="empty-state__icon" aria-hidden="true">{{ icon }}</div>
    <h3 class="empty-state__title">{{ title }}</h3>
    <p v-if="text" class="empty-state__text">{{ text }}</p>
    <div v-if="$slots.default" class="empty-state__action">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-sm);
  padding: var(--space-xl);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.empty-state--compact {
  padding: var(--space-lg);
}

.empty-state__icon {
  font-size: 2rem;
}

.empty-state__title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.empty-state__text {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
  margin: 0;
  max-width: 42ch;
}

.empty-state__action {
  margin-top: var(--space-sm);
}
</style>
