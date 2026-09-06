<script setup lang="ts">
/**
 * ComingSoon — pantalla para secciones que dependen del backend (aún pendiente).
 * Uso: <ComingSoon title="Explorar" text="Recomendaciones y descubrimiento." />
 */
defineProps<{ title: string; text: string; icon?: string }>()
</script>

<template>
  <div class="coming-soon">
    <p class="coming-soon__eyebrow">Próximamente</p>
    <div v-if="icon" class="coming-soon__icon" aria-hidden="true">{{ icon }}</div>
    <h1 class="coming-soon__title">{{ title }}</h1>
    <p class="coming-soon__text">{{ text }}</p>
    <p class="coming-soon__note">Esta sección se activará cuando el backend esté disponible.</p>
  </div>
</template>

<style scoped>
.coming-soon {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-sm);
  padding: var(--space-xl);
  min-height: 60vh;
}

.coming-soon__eyebrow {
  color: var(--color-accent);
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}

.coming-soon__icon {
  font-size: 2.5rem;
}

.coming-soon__title {
  color: var(--color-text);
  font-size: 2rem;
  font-weight: 800;
  margin: 0;
}

.coming-soon__text {
  color: var(--color-text-muted);
  margin: 0;
  max-width: 44ch;
}

.coming-soon__note {
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
  margin: var(--space-sm) 0 0 0;
}
</style>
