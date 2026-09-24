<script setup lang="ts">
/**
 * MediaCard — tarjeta de una obra de la colección. Recibe la entidad completa
 * y deriva su presentación del catálogo. Acciones: favorito, editar, eliminar.
 * Editar y Eliminar son botones siempre visibles (antes vivían en un menú ⋮
 * que el `overflow: hidden` de la tarjeta recortaba).
 *
 * Uso:
 *   <MediaCard :entry="entry" @toggle-favorite="..." @edit="..." @delete="..." />
 */
import BaseBadge from './BaseBadge.vue'
import BaseIcon from './BaseIcon.vue'
import RatingStars from './RatingStars.vue'
import ProgressBar from './ProgressBar.vue'
import { statusMeta, typeMeta } from '../lib/catalog'
import type { MediaEntry } from '../types/media'

defineProps<{ entry: MediaEntry }>()

const emit = defineEmits<{ 'toggle-favorite': []; edit: []; delete: [] }>()
</script>

<template>
  <article class="media-card">
    <div class="media-card__cover">
      <img v-if="entry.cover" :src="entry.cover" :alt="entry.title" loading="lazy" />
      <div v-else class="media-card__cover-placeholder" aria-hidden="true">
        <BaseIcon :name="typeMeta(entry.type).icon" />
      </div>

      <button
        class="media-card__favorite"
        :class="{ 'media-card__favorite--active': entry.favorite }"
        type="button"
        :aria-pressed="entry.favorite"
        :aria-label="entry.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'"
        @click="emit('toggle-favorite')"
      >
        <BaseIcon :name="entry.favorite ? 'heart-fill' : 'heart'" />
      </button>
    </div>

    <div class="media-card__body">
      <BaseBadge>{{ typeMeta(entry.type).label }}</BaseBadge>
      <h3 class="media-card__title">{{ entry.title }}</h3>
      <p v-if="entry.creator" class="media-card__subtitle">{{ entry.creator }}</p>

      <div class="media-card__footer">
        <RatingStars v-if="entry.rating != null" :value="entry.rating" />
        <ProgressBar v-else-if="entry.status === 'in-progress' && entry.progress != null" :percent="entry.progress" />
        <span
          v-else
          class="media-card__status"
          :style="{ color: statusMeta(entry.status).color }"
        >
          {{ statusMeta(entry.status).label }}
        </span>
      </div>

      <div class="media-card__actions">
        <button
          type="button"
          class="media-card__btn media-card__btn--edit"
          :aria-label="`Editar ${entry.title}`"
          @click="emit('edit')"
        >
          <BaseIcon name="pencil" /> Editar
        </button>
        <button
          type="button"
          class="media-card__btn media-card__btn--delete"
          :aria-label="`Eliminar ${entry.title}`"
          title="Eliminar"
          @click="emit('delete')"
        >
          <BaseIcon name="trash" />
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.media-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.media-card__cover {
  position: relative;
  aspect-ratio: 3 / 4;
  background: var(--color-surface-2);
}

.media-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-card__cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  opacity: 0.4;
  background: linear-gradient(135deg, var(--color-surface-2), var(--color-surface));
}

.media-card__favorite {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: var(--fig-cream);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-card__favorite--active {
  color: var(--color-warning); /* Golden Fig */
}

.media-card__body {
  flex: 1;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.media-card__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.media-card__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-xs) 0;
}

.media-card__footer {
  margin-top: var(--space-xs);
  min-height: 20px;
  display: flex;
  align-items: center;
}

.media-card__status {
  font-size: 0.8125rem;
  font-weight: 600;
}

/* Acciones siempre visibles, pegadas al fondo (el body es flex: 1) para que
   todas las tarjetas de una fila las tengan a la misma altura. */
.media-card__actions {
  margin-top: auto;
  padding-top: var(--space-sm);
  display: flex;
  gap: var(--space-xs);
}

.media-card__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-text);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.media-card__btn--edit {
  flex: 1;
}

.media-card__btn--edit:hover,
.media-card__btn--edit:focus-visible {
  border-color: var(--color-accent);
  background: var(--color-accent-hover-bg);
  color: var(--color-accent-hover-contrast);
}

.media-card__btn--delete {
  flex-shrink: 0;
  width: 34px;
  padding: 6px 0;
  color: var(--color-text-muted);
}

.media-card__btn--delete:hover,
.media-card__btn--delete:focus-visible {
  border-color: var(--color-danger);
  color: var(--color-danger);
}
</style>
