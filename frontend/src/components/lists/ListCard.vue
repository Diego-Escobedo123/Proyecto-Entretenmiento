<script setup lang="ts">
/**
 * ListCard — tarjeta de una lista: collage de hasta 4 portadas, nombre,
 * cuántas obras tiene y si es pública. Lleva al detalle (/lists/:id).
 *
 * Uso:
 *   <ListCard :list="summary" />
 */
import { computed, ref } from 'vue'
import BaseBadge from '../BaseBadge.vue'
import BaseIcon from '../BaseIcon.vue'
import type { ListSummary } from '../../types/list'

const props = defineProps<{ list: ListSummary }>()

/** Portadas externas que ya no cargan se sacan del collage. */
const broken = ref(new Set<string>())
const covers = computed(() => props.list.covers.filter((c) => !broken.value.has(c)).slice(0, 4))
</script>

<template>
  <RouterLink :to="`/lists/${list.id}`" class="list-card">
    <div class="list-card__collage" :class="covers.length ? `list-card__collage--${covers.length}` : 'list-card__collage--empty'">
      <img
        v-for="cover in covers"
        :key="cover"
        :src="cover"
        alt=""
        class="list-card__cover"
        loading="lazy"
        @error="broken.add(cover)"
      />
      <BaseIcon v-if="!covers.length" name="card-list" class="list-card__placeholder" />
    </div>
    <div class="list-card__footer">
      <div class="list-card__text">
        <h3 class="list-card__title">{{ list.title }}</h3>
        <p class="list-card__count">
          {{ list.itemCount }} {{ list.itemCount === 1 ? 'obra' : 'obras' }}
          <template v-if="list.ranked"> · Ranking</template>
        </p>
      </div>
      <BaseBadge :variant="list.isPublic ? 'accent' : 'default'">
        <BaseIcon :name="list.isPublic ? 'globe' : 'lock-fill'" />
        {{ list.isPublic ? 'Pública' : 'Privada' }}
      </BaseBadge>
    </div>
  </RouterLink>
</template>

<style scoped>
.list-card { display: block; width: 100%; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-sm); cursor: pointer; text-align: left; font: inherit; color: inherit; transition: border-color 0.15s ease; }
.list-card:hover, .list-card:focus-visible { border-color: var(--color-accent); }
.list-card__collage { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 4px; aspect-ratio: 1 / 1; border-radius: var(--radius-md); overflow: hidden; margin-bottom: var(--space-sm); background: var(--color-surface-2); }
.list-card__collage--empty { display: flex; align-items: center; justify-content: center; }
.list-card__placeholder { font-size: 2.5rem; color: var(--color-text-subtle); }
.list-card__cover { width: 100%; height: 100%; object-fit: cover; }
/* Con menos de 4 portadas el collage se reparte sin huecos. */
.list-card__collage--1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
.list-card__collage--2 { grid-template-rows: 1fr; }
.list-card__collage--3 .list-card__cover:first-child { grid-row: span 2; }
.list-card__footer { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }
.list-card__text { min-width: 0; }
.list-card__title { font-size: 1rem; font-weight: 700; color: var(--color-text); margin: 0 0 2px 0; overflow-wrap: anywhere; }
.list-card__count { font-size: 0.8125rem; color: var(--color-text-muted); margin: 0; }
</style>
