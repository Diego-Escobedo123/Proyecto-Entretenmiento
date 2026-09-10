<script setup lang="ts">
defineProps<{ cover: string; title: string; award: string }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <button class="award-card" type="button" @click="$emit('open')">
    <img class="award-card__cover" :src="cover" :alt="title" />
    <p class="award-card__title">{{ title }}</p>
    <p class="award-card__award">{{ award }}</p>
  </button>
</template>

<style scoped>
.award-card { display: block; width: 100%; border: none; background: none; padding: 0; cursor: pointer; text-align: left; font: inherit; }
.award-card__cover { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-sm); }
.award-card__title { font-size: 0.9375rem; font-weight: 700; color: var(--color-text); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.award-card__award { font-size: 0.8125rem; color: var(--color-text-muted); margin: 2px 0 0 0; }
</style>