<script setup lang="ts">
/**
 * MediaCard — tarjeta de una obra de la colección. Recibe la entidad completa
 * y deriva su presentación del catálogo. Acciones: favorito, editar, eliminar.
 *
 * Uso:
 *   <MediaCard :entry="entry" @toggle-favorite="..." @edit="..." @delete="..." />
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BaseBadge from './BaseBadge.vue'
import RatingStars from './RatingStars.vue'
import ProgressBar from './ProgressBar.vue'
import { statusMeta, typeMeta } from '../lib/catalog'
import type { MediaEntry } from '../types/media'

defineProps<{ entry: MediaEntry }>()

const emit = defineEmits<{ 'toggle-favorite': []; edit: []; delete: [] }>()

const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) menuOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function choose(action: 'edit' | 'delete') {
  menuOpen.value = false
  if (action === 'edit') emit('edit')
  else emit('delete')
}
</script>

<template>
  <article ref="root" class="media-card">
    <div class="media-card__cover">
      <img v-if="entry.cover" :src="entry.cover" :alt="entry.title" loading="lazy" />
      <div v-else class="media-card__cover-placeholder" aria-hidden="true">
        {{ typeMeta(entry.type).icon }}
      </div>

      <button
        class="media-card__favorite"
        :class="{ 'media-card__favorite--active': entry.favorite }"
        type="button"
        :aria-pressed="entry.favorite"
        :aria-label="entry.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'"
        @click="emit('toggle-favorite')"
      >
        ♥
      </button>
    </div>

    <div class="media-card__body">
      <BaseBadge>{{ typeMeta(entry.type).label }}</BaseBadge>
      <h3 class="media-card__title">{{ entry.title }}</h3>
      <p v-if="entry.creator" class="media-card__subtitle">{{ entry.creator }}</p>

      <div class="media-card__footer">
        <span class="media-card__footer-main">
          <RatingStars v-if="entry.rating != null" :value="entry.rating" />
          <ProgressBar v-else-if="entry.status === 'in-progress' && entry.progress != null" :percent="entry.progress" />
          <span
            v-else
            class="media-card__status"
            :style="{ color: statusMeta(entry.status).color }"
          >
            {{ statusMeta(entry.status).label }}
          </span>
        </span>

        <div class="media-card__menu">
          <button
            class="media-card__action"
            type="button"
            aria-haspopup="true"
            :aria-expanded="menuOpen"
            aria-label="Más acciones"
            @click="menuOpen = !menuOpen"
          >
            ⋮
          </button>
          <div v-if="menuOpen" class="media-card__dropdown" role="menu">
            <button type="button" role="menuitem" @click="choose('edit')">Editar</button>
            <button type="button" role="menuitem" class="media-card__danger" @click="choose('delete')">
              Eliminar
            </button>
          </div>
        </div>
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
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-card__favorite--active {
  color: var(--color-accent);
}

.media-card__body {
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
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.media-card__footer-main {
  flex: 1;
  min-width: 0;
}

.media-card__status {
  font-size: 0.8125rem;
  font-weight: 600;
}

.media-card__menu {
  position: relative;
  flex-shrink: 0;
}

.media-card__action {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
}

.media-card__action:hover {
  color: var(--color-text);
  background: var(--color-surface-2);
}

.media-card__dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 10;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-xs);
  display: flex;
  flex-direction: column;
  min-width: 130px;
}

.media-card__dropdown button {
  background: none;
  border: none;
  text-align: left;
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}

.media-card__dropdown button:hover {
  background: var(--color-surface);
}

.media-card__danger {
  color: #f87171;
}
</style>
