<script setup lang="ts">
/**
 * ActivityReviewCard — reseña reciente de alguien que el usuario sigue.
 * Hardcodeado por ahora: en el futuro vendrá del endpoint de feed social.
 */
import RatingStars from '../RatingStars.vue'
import BaseTag from '../BaseTag.vue'

defineProps<{
  userName: string
  userAvatar: string
  timeAgo: string
  rating: number
  workTitle: string
  workAuthor: string
  workYear: number | string
  tags: string[]
  cover: string
  quote: string
}>()
</script>

<template>
  <article class="activity-card">
    <header class="activity-card__header">
      <div class="activity-card__who">
        <img class="activity-card__avatar" :src="userAvatar" :alt="userName" />
        <div>
          <p class="activity-card__line">
            <span class="activity-card__name">{{ userName }}</span> calificó una obra
          </p>
          <p class="activity-card__time">{{ timeAgo }}</p>
        </div>
      </div>

      <RatingStars :value="rating" />
    </header>

    <div class="activity-card__body">
      <img class="activity-card__cover" :src="cover" :alt="workTitle" />

      <div class="activity-card__work">
        <h3 class="activity-card__title">{{ workTitle }}</h3>
        <p class="activity-card__subtitle">{{ workAuthor }} · {{ workYear }}</p>

        <div class="activity-card__tags">
          <BaseTag v-for="tag in tags" :key="tag" :clickable="false">{{ tag }}</BaseTag>
        </div>

        <blockquote class="activity-card__quote">"{{ quote }}"</blockquote>
      </div>
    </div>
  </article>
</template>

<style scoped>
.activity-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
}

.activity-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.activity-card__who {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.activity-card__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.activity-card__line {
  font-size: 0.875rem;
  color: var(--color-text);
  margin: 0;
}

.activity-card__name {
  color: var(--color-accent);
  font-weight: 700;
}

.activity-card__time {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  margin: 0;
}

.activity-card__body {
  display: flex;
  gap: var(--space-md);
}

.activity-card__cover {
  width: 80px;
  height: 112px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.activity-card__work {
  min-width: 0;
}

.activity-card__title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 2px 0;
}

.activity-card__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-sm) 0;
}

.activity-card__tags {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.activity-card__quote {
  margin: 0;
  padding-left: var(--space-sm);
  border-left: 2px solid var(--color-accent);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.9375rem;
  color: var(--color-text-muted);
}
</style>