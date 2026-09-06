<script setup lang="ts">
/**
 * TrendingCard — tarjeta de imagen con overlay para "Trending Now".
 * Hardcodeado por ahora: en el futuro vendrá de un endpoint de tendencias
 * agregadas desde las 4 categorías.
 */
import BaseIcon from '../BaseIcon.vue'

withDefaults(
  defineProps<{
    kind: string
    title: string
    cover: string
    rating?: number | string
    badge?: string
    size?: 'lg' | 'sm'
  }>(),
  { size: 'sm' },
)

defineEmits<{ open: [] }>()
</script>

<template>
  <button class="trending-card" :class="`trending-card--${size}`" type="button" @click="$emit('open')">
    <img class="trending-card__image" :src="cover" :alt="title" />
    <div class="trending-card__overlay" />

    <div class="trending-card__top">
      <span class="trending-card__kind">{{ kind }}</span>
      <span v-if="badge" class="trending-card__badge">{{ badge }}</span>
    </div>

    <div class="trending-card__bottom">
      <p class="trending-card__title">{{ title }}</p>
      <p v-if="rating" class="trending-card__rating">
        <BaseIcon name="star-fill" /> {{ rating }}
      </p>
    </div>
  </button>
</template>

<style scoped>
.trending-card {
  position: relative;
  display: block;
  width: 100%;
  border: none;
  padding: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.trending-card--lg {
  height: 208px;
}

.trending-card--sm {
  height: 96px;
}

.trending-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.trending-card__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.1) 60%, transparent);
}

.trending-card__top {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  display: flex;
  gap: var(--space-xs);
}

.trending-card__kind {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.6);
  color: var(--fig-cream);
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
}

.trending-card__badge {
  font-size: 0.6875rem;
  font-weight: 700;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
}

.trending-card__bottom {
  position: absolute;
  bottom: var(--space-xs);
  left: var(--space-sm);
  right: var(--space-sm);
}

.trending-card__title {
  color: var(--fig-cream);
  font-weight: 700;
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.2;
}

.trending-card__rating {
  display: flex;
  align-items: center;
  gap: 2px;
  color: var(--color-warning);
  font-size: 0.75rem;
  margin: 2px 0 0 0;
}
</style>