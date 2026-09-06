<script setup lang="ts">
/**
 * NewReleaseCard — lanzamiento reciente en una categoría (ej. música).
 * Hardcodeado por ahora: en el futuro vendrá de la integración con la API
 * externa correspondiente (Spotify, TMDB, etc.) vía el backend.
 */
import BaseIcon from '../BaseIcon.vue'
import BaseButton from '../BaseButton.vue'

defineProps<{
  category: string
  title: string
  artist: string
  description: string
  cover: string
}>()

defineEmits<{ 'add-to-list': []; 'toggle-favorite': [] }>()
</script>

<template>
  <article class="release-card">
    <p class="release-card__eyebrow">
      <BaseIcon name="stars" /> Nuevo lanzamiento en {{ category }}
    </p>

    <div class="release-card__body">
      <img class="release-card__cover" :src="cover" :alt="title" />

      <div class="release-card__info">
        <h3 class="release-card__title">{{ title }}</h3>
        <p class="release-card__artist">{{ artist }}</p>
        <p class="release-card__description">{{ description }}</p>

        <div class="release-card__actions">
          <BaseButton @click="$emit('add-to-list')">Agregar a lista</BaseButton>
          <button
            class="release-card__favorite"
            type="button"
            aria-label="Favorito"
            @click="$emit('toggle-favorite')"
          >
            <BaseIcon name="heart" />
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.release-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
}

.release-card__eyebrow {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 var(--space-md) 0;
}

.release-card__body {
  display: flex;
  gap: var(--space-md);
}

.release-card__cover {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.release-card__info {
  min-width: 0;
}

.release-card__title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 2px 0;
}

.release-card__artist {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-sm) 0;
}

.release-card__description {
  font-family: var(--font-serif);
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-md) 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.release-card__actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.release-card__favorite {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.release-card__favorite:hover,
.release-card__favorite:active {
  background: var(--color-accent-hover-bg);
  color: var(--color-accent-hover-contrast);
  border-color: var(--color-accent-hover);
}
</style>