<script setup lang="ts">
/**
 * ContinueConsumingCard — obra en progreso para retomar desde Inicio: su
 * avance propio ("p. 180 de 495", "T3 · E5", "12 h · PS5") y un botón para
 * actualizarlo. Clic en la portada o el título abre la ficha.
 *
 * Uso:
 *   <ContinueConsumingCard :entry="entry" @open="…" @update="…" />
 */
import { computed } from 'vue'
import BaseBadge from '../BaseBadge.vue'
import BaseIcon from '../BaseIcon.vue'
import ProgressBar from '../ProgressBar.vue'
import { statusLabel, typeMeta } from '../../lib/catalog'
import { progressSummary } from '../../lib/progress'
import type { MediaEntry } from '../../types/media'

const props = defineProps<{ entry: MediaEntry }>()
defineEmits<{ open: []; update: [] }>()

const summary = computed(() => progressSummary(props.entry))
const progressText = computed(() => {
  const parts = [summary.value, props.entry.progress != null ? `${props.entry.progress}%` : null]
  return parts.filter(Boolean).join(' · ') || statusLabel(props.entry.type, props.entry.status)
})
</script>

<template>
  <div class="continue-card">
    <button type="button" class="continue-card__cover-btn" :aria-label="`Ver ficha de ${entry.title}`" @click="$emit('open')">
      <img v-if="entry.cover" class="continue-card__cover" :src="entry.cover" alt="" />
      <span v-else class="continue-card__cover continue-card__cover--empty" aria-hidden="true">
        <BaseIcon :name="typeMeta(entry.type).icon" />
      </span>
    </button>

    <div class="continue-card__body">
      <div class="continue-card__meta">
        <BaseBadge>{{ typeMeta(entry.type).label }}</BaseBadge>
        <span class="continue-card__progress-label">{{ progressText }}</span>
      </div>

      <button type="button" class="continue-card__title" @click="$emit('open')">{{ entry.title }}</button>
      <p v-if="entry.creator" class="continue-card__author">{{ entry.creator }}</p>

      <ProgressBar v-if="entry.progress != null" :percent="entry.progress" />
    </div>

    <button
      class="continue-card__resume"
      type="button"
      :aria-label="`Actualizar avance de ${entry.title}`"
      title="Actualizar avance"
      @click="$emit('update')"
    >
      <BaseIcon name="pencil" />
    </button>
  </div>
</template>

<style scoped>
.continue-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.continue-card__cover-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.continue-card__cover {
  display: block;
  width: 64px;
  height: 96px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
}

.continue-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-subtle);
}

.continue-card__body {
  flex: 1;
  min-width: 0;
}

.continue-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
  flex-wrap: wrap;
}

.continue-card__progress-label {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

.continue-card__title {
  display: block;
  max-width: 100%;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
  text-align: left;
  margin: 0 0 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.continue-card__title:hover {
  color: var(--color-accent);
}

.continue-card__author {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 var(--space-sm) 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.continue-card__resume {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  border: none;
  background: var(--color-surface-2);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.continue-card__resume:hover,
.continue-card__resume:active {
  background: var(--color-accent-hover-bg);
  color: var(--color-accent-hover-contrast);
}
</style>
