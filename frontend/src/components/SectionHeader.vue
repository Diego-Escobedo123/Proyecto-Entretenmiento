<script setup lang="ts">
/**
 * SectionHeader — patrón repetido: título de sección + link opcional "View All".
 * Uso: <SectionHeader title="Trending Now" link-text="View All" @link-click="..." />
 */
defineProps<{
  title: string
  linkText?: string
}>()

defineEmits<{ 'link-click': [] }>()
</script>

<template>
  <div class="section-header">
    <h2 class="section-header__title">{{ title }}</h2>
    <button
      v-if="linkText"
      class="section-header__link"
      type="button"
      @click="$emit('link-click')"
    >{{ linkText }}</button>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.section-header__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.section-header__link {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
