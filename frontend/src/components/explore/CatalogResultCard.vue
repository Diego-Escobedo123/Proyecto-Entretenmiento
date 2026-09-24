<script setup lang="ts">
/**
 * CatalogResultCard — resultado de un catálogo externo (TMDB, Google Books,
 * RAWG, iTunes) en Explorar. Si la obra ya está en la colección muestra
 * "En tu colección" (abre la edición); si no, "+ Agregar" (alta precargada).
 */
import BaseIcon from '../BaseIcon.vue'
import { typeMeta } from '../../lib/catalog'
import type { MediaType } from '../../types/media'
import type { ExternalSearchResult } from '../../types/search'

withDefaults(defineProps<{ result: ExternalSearchResult; type: MediaType; owned?: boolean }>(), {
  owned: false,
})
defineEmits<{ add: []; open: [] }>()
</script>

<template>
  <article class="catalog-card">
    <div class="catalog-card__cover-wrap">
      <img v-if="result.cover" :src="result.cover" :alt="result.title" class="catalog-card__cover" loading="lazy" />
      <div v-else class="catalog-card__cover catalog-card__cover--empty">
        <BaseIcon :name="typeMeta(type).icon" />
      </div>
    </div>

    <div class="catalog-card__body">
      <h3 class="catalog-card__title" :title="result.title">{{ result.title }}</h3>
      <p class="catalog-card__meta">
        {{ [result.creator, result.year].filter(Boolean).join(' · ') || ' ' }}
      </p>
    </div>

    <button
      v-if="owned"
      type="button"
      class="catalog-card__action catalog-card__action--owned"
      @click="$emit('open')"
    >
      <BaseIcon name="check-circle-fill" /> En tu colección
    </button>
    <button v-else type="button" class="catalog-card__action" @click="$emit('add')">
      + Agregar
    </button>
  </article>
</template>

<style scoped>
.catalog-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}

.catalog-card__cover {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.catalog-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--color-text-subtle);
}

.catalog-card__body {
  min-width: 0;
}

.catalog-card__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.catalog-card__meta {
  margin: 2px 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.catalog-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: auto;
  padding: 6px var(--space-sm);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  background: none;
  color: var(--color-accent);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
}

.catalog-card__action:hover {
  background: var(--color-accent-hover-bg);
  color: var(--color-accent-hover-contrast);
}

.catalog-card__action--owned {
  border-color: var(--color-border);
  color: var(--color-success);
}
</style>
