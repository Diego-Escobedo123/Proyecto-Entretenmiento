<script setup lang="ts">
/**
 * HiddenGemCard — tarjeta grande/pequeña para contenido poco conocido pero
 * bien valorado. Hardcodeado por ahora: en el futuro vendrá de un endpoint
 * de descubrimiento (obras con pocas vistas pero rating alto).
 */
withDefaults(
  defineProps<{
    kind: string
    year?: number | string
    title: string
    description?: string
    cover: string
    size?: 'lg' | 'sm'
  }>(),
  { size: 'sm' },
)

defineEmits<{ open: [] }>()
</script>

<template>
  <button class="gem-card" :class="`gem-card--${size}`" type="button" @click="$emit('open')">
    <img class="gem-card__image" :src="cover" :alt="title" />
    <div class="gem-card__overlay" />

    <div class="gem-card__content">
      <span v-if="size === 'lg'" class="gem-card__kind">{{ kind }}<template v-if="year"> · {{ year }}</template></span>
      <span v-else class="gem-card__kind gem-card__kind--pill">{{ kind }}</span>

      <h3 class="gem-card__title">{{ title }}</h3>
      <p v-if="description && size === 'lg'" class="gem-card__description">{{ description }}</p>
    </div>
  </button>
</template>

<style scoped>
.gem-card {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  padding: 0;
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.gem-card--lg {
  min-height: 340px;
}

.gem-card--sm {
  min-height: 160px;
}

.gem-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gem-card__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.15) 55%, transparent);
}

.gem-card__content {
  position: absolute;
  bottom: var(--space-md);
  left: var(--space-md);
  right: var(--space-md);
}

.gem-card__kind {
  display: inline-block;
  font-size: 0.75rem;
  color: var(--fig-cream);
  opacity: 0.85;
  margin-bottom: var(--space-xs);
}

.gem-card__kind--pill {
  background: rgba(0, 0, 0, 0.55);
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
  font-weight: 700;
  text-transform: uppercase;
}

.gem-card__title {
  color: var(--fig-cream);
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 var(--space-xs) 0;
  line-height: 1.2;
}

.gem-card--sm .gem-card__title {
  font-size: 1rem;
}

.gem-card__description {
  color: var(--rose);
  font-family: var(--font-serif);
  font-size: 0.875rem;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>