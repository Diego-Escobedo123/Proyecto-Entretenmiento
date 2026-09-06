<script setup lang="ts">
/**
 * ContinueConsumingCard — obra en progreso que el usuario puede retomar.
 * Hardcodeado por ahora: cuando exista el backend, estos props vendrán de un
 * getter "en progreso" del media store en vez de datos fijos en Home.
 */
import BaseBadge from '../BaseBadge.vue'
import BaseIcon from '../BaseIcon.vue'
import ProgressBar from '../ProgressBar.vue'

defineProps<{
  typeLabel: string
  progress: number
  title: string
  author: string
  cover: string
}>()

defineEmits<{ resume: [] }>()
</script>

<template>
  <div class="continue-card">
    <img class="continue-card__cover" :src="cover" :alt="title" />

    <div class="continue-card__body">
      <div class="continue-card__meta">
        <BaseBadge>{{ typeLabel }}</BaseBadge>
        <span class="continue-card__progress-label">{{ progress }}% Completed</span>
      </div>

      <h3 class="continue-card__title">{{ title }}</h3>
      <p class="continue-card__author">{{ author }}</p>

      <ProgressBar :percent="progress" />
    </div>

    <button class="continue-card__resume" type="button" aria-label="Continuar" @click="$emit('resume')">
      <BaseIcon name="play-fill" />
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

.continue-card__cover {
  width: 64px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
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
}

.continue-card__progress-label {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.continue-card__title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 2px 0;
}

.continue-card__author {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 var(--space-sm) 0;
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