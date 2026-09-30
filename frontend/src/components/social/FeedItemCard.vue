<script setup lang="ts">
/**
 * FeedItemCard — una entrada del feed: "Beto terminó Dune" (con estrellas,
 * si fue otra vez y su reseña), "empezó a leer…", "dejó…", o "creó la
 * lista…". Clic en la obra abre su ficha; en la lista, la lista.
 *
 * Uso:
 *   <FeedItemCard :item="item" />
 */
import { computed } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import RatingStars from '../RatingStars.vue'
import UserAvatar from './UserAvatar.vue'
import { typeMeta } from '../../lib/catalog'
import { formatDay, relativeTime } from '../../lib/dates'
import { useUiStore } from '../../stores/ui'
import type { FeedItem } from '../../types/social'
import type { MediaType } from '../../types/media'

const props = defineProps<{ item: FeedItem }>()
const ui = useUiStore()

/** Verbo según lo que hizo y el tipo de obra: "empezó a leer", "terminó de ver", "volvió a jugar"… */
const VERBS: Record<MediaType, { started: string; finished: string; again: string; abandoned: string }> = {
  movie: { started: 'empezó a ver', finished: 'vio', again: 'volvió a ver', abandoned: 'dejó' },
  series: { started: 'empezó a ver', finished: 'terminó de ver', again: 'volvió a ver', abandoned: 'dejó' },
  book: { started: 'empezó a leer', finished: 'terminó de leer', again: 'volvió a leer', abandoned: 'dejó' },
  game: { started: 'empezó a jugar', finished: 'terminó', again: 'volvió a jugar', abandoned: 'dejó' },
  music: { started: 'empezó a escuchar', finished: 'escuchó', again: 'volvió a escuchar', abandoned: 'dejó' },
}

const verb = computed(() => {
  const it = props.item
  if (it.kind === 'list') return 'creó la lista'
  const verbs = VERBS[it.work.type]
  return it.repeat && it.kind === 'finished' ? verbs.again : verbs[it.kind]
})

function openWork() {
  if (props.item.kind === 'list') return
  const w = props.item.work
  ui.openWorkDetail({ ...w })
}
</script>

<template>
  <article class="feed-item">
    <UserAvatar :user="item.user" :size="40" />

    <div class="feed-item__body">
      <p class="feed-item__line">
        <RouterLink :to="`/users/${item.user.id}`" class="feed-item__user">{{ item.user.name }}</RouterLink>
        {{ verb }}
        <template v-if="item.kind === 'list'">
          <RouterLink :to="`/lists/${item.list.id}`" class="feed-item__target">{{ item.list.title }}</RouterLink>
        </template>
        <button v-else type="button" class="feed-item__target" @click="openWork">{{ item.work.title }}</button>
      </p>

      <p class="feed-item__meta">
        <span :title="new Date(item.at).toLocaleString('es')">{{ relativeTime(item.at) }}</span>
        <template v-if="item.kind !== 'list'">
          · <BaseIcon :name="typeMeta(item.work.type).icon" /> {{ typeMeta(item.work.type).label }}
          <template v-if="item.day && item.kind !== 'started'"> · el {{ formatDay(item.day) }}</template>
          <span v-if="item.repeat" class="feed-item__repeat"><BaseIcon name="arrow-repeat" /> Otra vez</span>
        </template>
        <template v-else> · {{ item.list.itemCount }} {{ item.list.itemCount === 1 ? 'obra' : 'obras' }}</template>
      </p>

      <RatingStars v-if="item.kind === 'finished' && item.rating != null" :value="item.rating" class="feed-item__stars" />
      <p v-if="item.kind !== 'list' && item.review" class="feed-item__review">{{ item.review }}</p>
    </div>

    <button
      v-if="item.kind !== 'list' && item.work.cover"
      type="button"
      class="feed-item__cover-btn"
      :aria-label="`Ver ficha de ${item.work.title}`"
      @click="openWork"
    >
      <img :src="item.work.cover" alt="" class="feed-item__cover" loading="lazy" />
    </button>
    <RouterLink
      v-else-if="item.kind === 'list' && item.list.covers.length"
      :to="`/lists/${item.list.id}`"
      class="feed-item__collage"
      :aria-label="`Ver lista ${item.list.title}`"
    >
      <img v-for="c in item.list.covers.slice(0, 4)" :key="c" :src="c" alt="" loading="lazy" />
    </RouterLink>
  </article>
</template>

<style scoped>
.feed-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.feed-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feed-item__line {
  margin: 0;
  font-family: var(--font-sans);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.feed-item__user,
.feed-item__target {
  font-weight: 700;
  color: var(--color-text);
}

.feed-item__target {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.feed-item__user:hover,
.feed-item__target:hover {
  color: var(--color-accent);
}

.feed-item__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
}

.feed-item__repeat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
  font-weight: 600;
  color: var(--color-accent);
}

.feed-item__stars {
  margin-top: 2px;
}

.feed-item__review {
  margin: 4px 0 0;
  padding-left: var(--space-sm);
  border-left: 2px solid var(--color-accent);
  color: var(--color-text);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.feed-item__cover-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.feed-item__cover {
  display: block;
  width: 56px;
  height: 84px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface-2);
}

.feed-item__collage {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface-2);
}

.feed-item__collage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 480px) {
  .feed-item {
    padding: var(--space-sm);
    gap: var(--space-sm);
  }

  .feed-item__cover {
    width: 44px;
    height: 66px;
  }
}
</style>
