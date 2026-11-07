<script setup lang="ts">
/**
 * WishlistCard — tarjeta fija de la wishlist al inicio de "Tus listas":
 * mismo formato que `ListCard` (collage + nombre + cuántas obras), pero se
 * llena sola con las obras marcadas como "Quiero verla/leerlo/…".
 *
 * Uso:
 *   <WishlistCard />
 */
import { computed, ref } from 'vue'
import BaseBadge from '../BaseBadge.vue'
import BaseIcon from '../BaseIcon.vue'
import { useMediaStore } from '../../stores/media'

const media = useMediaStore()

const broken = ref(new Set<string>())
const covers = computed(() =>
  media.wishlist
    .map((e) => e.cover)
    .filter((c): c is string => Boolean(c) && !broken.value.has(c!))
    .slice(0, 4),
)
const count = computed(() => media.wishlist.length)
</script>

<template>
  <RouterLink to="/lists/wishlist" class="wishlist-card">
    <div
      class="wishlist-card__collage"
      :class="covers.length ? `wishlist-card__collage--${covers.length}` : 'wishlist-card__collage--empty'"
    >
      <img
        v-for="cover in covers"
        :key="cover"
        :src="cover"
        alt=""
        class="wishlist-card__cover"
        loading="lazy"
        @error="broken.add(cover)"
      />
      <BaseIcon v-if="!covers.length" name="bookmark-heart" class="wishlist-card__placeholder" />
    </div>
    <div class="wishlist-card__footer">
      <div class="wishlist-card__text">
        <h3 class="wishlist-card__title">Wishlist</h3>
        <p class="wishlist-card__count">{{ count }} {{ count === 1 ? 'obra' : 'obras' }} por descubrir</p>
      </div>
      <BaseBadge variant="accent"><BaseIcon name="bookmark-heart-fill" /> Fija</BaseBadge>
    </div>
  </RouterLink>
</template>

<style scoped>
.wishlist-card { display: block; width: 100%; background: var(--color-surface); border: 1px solid var(--color-accent-bg); border-radius: var(--radius-lg); padding: var(--space-sm); color: inherit; transition: border-color 0.15s ease; }
.wishlist-card:hover, .wishlist-card:focus-visible { border-color: var(--color-accent); }
.wishlist-card__collage { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 4px; aspect-ratio: 1 / 1; border-radius: var(--radius-md); overflow: hidden; margin-bottom: var(--space-sm); background: var(--color-surface-2); }
.wishlist-card__collage--empty { display: flex; align-items: center; justify-content: center; background: var(--color-accent-bg); }
.wishlist-card__placeholder { font-size: 2.5rem; color: var(--color-accent); }
.wishlist-card__cover { width: 100%; height: 100%; object-fit: cover; }
.wishlist-card__collage--1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
.wishlist-card__collage--2 { grid-template-rows: 1fr; }
.wishlist-card__collage--3 .wishlist-card__cover:first-child { grid-row: span 2; }
.wishlist-card__footer { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }
.wishlist-card__text { min-width: 0; }
.wishlist-card__title { font-size: 1rem; font-weight: 700; color: var(--color-text); margin: 0 0 2px 0; }
.wishlist-card__count { font-size: 0.8125rem; color: var(--color-text-muted); margin: 0; }
</style>
