<script setup lang="ts">
/**
 * Wishlist — lo que quieres ver, leer, jugar o escuchar (como la watchlist
 * de Letterboxd o el "Want to read" de Goodreads). No es una lista aparte:
 * son las obras de la colección en estado `want`, así que al empezarlas o
 * terminarlas salen solas. Se agregan desde la ficha de cualquier obra.
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import MediaCard from '../components/MediaCard.vue'
import BaseTag from '../components/BaseTag.vue'
import BaseIcon from '../components/BaseIcon.vue'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { MEDIA_TYPES } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'
import type { MediaEntry, MediaType } from '../types/media'

const media = useMediaStore()
const ui = useUiStore()
const router = useRouter()
const { wishlist, loading } = storeToRefs(media)
const { searchQuery } = storeToRefs(ui)

const typeFilter = ref<MediaType | 'all'>('all')

/** Sólo los tipos que tienen algo en la wishlist, con cuántas obras. */
const typeTabs = computed(() =>
  MEDIA_TYPES.map((t) => ({ ...t, count: wishlist.value.filter((e) => e.type === t.value).length })).filter(
    (t) => t.count > 0,
  ),
)

type SortKey = 'added' | 'title' | 'year'
const sortKey = ref<SortKey>('added')
const sortLabels: Record<SortKey, string> = {
  added: 'Agregadas recientemente',
  title: 'Título (A–Z)',
  year: 'Más nuevas',
}

function cycleSort() {
  const order: SortKey[] = ['added', 'title', 'year']
  sortKey.value = order[(order.indexOf(sortKey.value) + 1) % order.length]
}

const visible = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = wishlist.value.filter(
    (e) =>
      (typeFilter.value === 'all' || e.type === typeFilter.value) &&
      (!q || e.title.toLowerCase().includes(q) || e.creator.toLowerCase().includes(q)),
  )
  // `wishlist` ya viene por fecha de agregado.
  if (sortKey.value === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title, 'es'))
  if (sortKey.value === 'year') return [...list].sort((a, b) => (b.year ?? -1) - (a.year ?? -1))
  return list
})

const pendingRemove = ref<MediaEntry | null>(null)
async function confirmRemove() {
  if (!pendingRemove.value) return
  await media.deleteEntry(pendingRemove.value.id)
  pendingRemove.value = null
}
</script>

<template>
  <div class="wishlist">
    <RouterLink to="/lists" class="wishlist__back"><BaseIcon name="arrow-left" /> Tus listas</RouterLink>

    <header class="wishlist__head">
      <div class="wishlist__icon" aria-hidden="true"><BaseIcon name="bookmark-heart-fill" /></div>
      <div>
        <h1 class="wishlist__title">Wishlist</h1>
        <p class="wishlist__subtitle">
          {{ wishlist.length }} {{ wishlist.length === 1 ? 'obra' : 'obras' }} que quieres ver, leer, jugar o escuchar.
          Al empezarlas salen de aquí solas.
        </p>
      </div>
    </header>

    <p v-if="loading && !media.loaded" class="wishlist__hint">Cargando…</p>

    <EmptyState
      v-else-if="!wishlist.length"
      icon="bookmark-heart"
      title="Tu wishlist está vacía"
      text="Abre la ficha de cualquier obra en Explorar y toca “Agregar a wishlist”. También entra aquí todo lo que registres como “Quiero verla”, “Quiero leerlo”…"
    >
      <BaseButton @click="router.push('/explore')">Ir a Explorar</BaseButton>
    </EmptyState>

    <template v-else>
      <div class="wishlist__toolbar">
        <div class="wishlist__filters">
          <BaseTag :active="typeFilter === 'all'" @click="typeFilter = 'all'">Todo · {{ wishlist.length }}</BaseTag>
          <BaseTag
            v-for="t in typeTabs"
            :key="t.value"
            :active="typeFilter === t.value"
            @click="typeFilter = t.value"
          >
            <BaseIcon :name="t.icon" /> {{ t.plural }} · {{ t.count }}
          </BaseTag>
        </div>
        <button type="button" class="wishlist__sort" @click="cycleSort">
          Orden: <strong>{{ sortLabels[sortKey] }}</strong>
        </button>
      </div>

      <div v-if="visible.length" class="wishlist__grid">
        <MediaCard
          v-for="entry in visible"
          :key="entry.id"
          :entry="entry"
          @open="ui.openWorkDetail(entry)"
          @toggle-favorite="media.toggleFavorite(entry.id)"
          @edit="ui.openEditEntry(entry.id)"
          @delete="pendingRemove = entry"
        />
      </div>
      <EmptyState v-else compact icon="search" title="Nada coincide" text="Prueba con otro tipo o búsqueda." />
    </template>

    <ConfirmDialog
      v-if="pendingRemove"
      title="Quitar de la wishlist"
      :message="`¿Quitar “${pendingRemove.title}” de tu wishlist? También sale de tu colección.`"
      @confirm="confirmRemove"
      @cancel="pendingRemove = null"
    />
  </div>
</template>

<style scoped>
.wishlist {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.wishlist__back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.wishlist__back:hover {
  color: var(--color-text);
}

.wishlist__head {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.wishlist__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-size: 1.75rem;
}

.wishlist__title {
  margin: 0;
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-text);
}

.wishlist__subtitle,
.wishlist__hint {
  margin: var(--space-xs) 0 0 0;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.wishlist__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.wishlist__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.wishlist__sort {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.875rem;
  padding: 8px var(--space-md);
  cursor: pointer;
  white-space: nowrap;
}

.wishlist__sort strong {
  color: var(--color-text);
}

.wishlist__sort:hover {
  border-color: var(--color-accent-hover);
}

.wishlist__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
}
</style>
