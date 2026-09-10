<script setup lang="ts">
/**
 * BaseSpinner — anillo de carga pequeño reutilizable.
 * Uso: <BaseSpinner /> o <BaseSpinner size="lg" />
 */
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
</script>

<template>
  <span class="base-spinner" :class="`base-spinner--${size}`" role="status" aria-label="Cargando" />
</template>

<style scoped>
.base-spinner {
  display: inline-block;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  animation: base-spinner-spin 0.7s linear infinite;
}

.base-spinner--sm {
  width: 14px;
  height: 14px;
}

.base-spinner--md {
  width: 20px;
  height: 20px;
}

.base-spinner--lg {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

@keyframes base-spinner-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>