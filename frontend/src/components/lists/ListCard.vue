<script setup lang="ts">
import BaseBadge from '../BaseBadge.vue'
import BaseIcon from '../BaseIcon.vue'

defineProps<{
  title: string
  itemCount: number
  visibility: 'public' | 'private'
  covers: string[]
}>()

defineEmits<{ open: [] }>()
</script>

<template>
  <button class="list-card" type="button" @click="$emit('open')">
    <div class="list-card__collage">
      <img v-for="(cover, i) in covers.slice(0, 4)" :key="i" :src="cover" alt="" class="list-card__cover" />
    </div>
    <div class="list-card__footer">
      <div>
        <h3 class="list-card__title">{{ title }}</h3>
        <p class="list-card__count">{{ itemCount }} obras</p>
      </div>
      <BaseBadge :variant="visibility === 'public' ? 'accent' : 'default'">
        <BaseIcon :name="visibility === 'public' ? 'globe' : 'lock-fill'" />
        {{ visibility === 'public' ? 'Pública' : 'Privada' }}
      </BaseBadge>
    </div>
  </button>
</template>

<style scoped>
.list-card { display: block; width: 100%; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-sm); cursor: pointer; text-align: left; font: inherit; }
.list-card__collage { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; aspect-ratio: 1 / 1; border-radius: var(--radius-md); overflow: hidden; margin-bottom: var(--space-sm); }
.list-card__cover { width: 100%; height: 100%; object-fit: cover; }
.list-card__footer { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }
.list-card__title { font-size: 1rem; font-weight: 700; color: var(--color-text); margin: 0 0 2px 0; }
.list-card__count { font-size: 0.8125rem; color: var(--color-text-muted); margin: 0; }
</style>