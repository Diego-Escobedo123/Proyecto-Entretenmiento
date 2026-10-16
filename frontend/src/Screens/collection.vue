<script setup lang="ts">
/**
 * Mi colección — grid completo con filtros por tipo y estado, orden y
 * búsqueda global (desde el store de UI). CRUD vía store de media.
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import MediaCard from '../components/MediaCard.vue'
import SkeletonCard from '../components/SkeletonCard.vue'
import ToggleIcon from '../components/ToggleIcon.vue'
import BaseTag from '../components/BaseTag.vue'
import BaseIcon from '../components/BaseIcon.vue'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'
import { MEDIA_STATUSES, MEDIA_TYPES } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'
import type { MediaStatus, MediaType } from '../types/media'

const media = useMediaStore()
const ui = useUiStore()
const { entries, loading, isEmpty } = storeToRefs(media)
const { searchQuery } = storeToRefs(ui)
const router = useRouter()

/** Texto buscado, si lo hay: permite ofrecer buscarlo en los catálogos (Explorar). */
const searchText = computed(() => searchQuery.value.trim())

function searchInCatalogs() {
  // El texto se conserva en el store: Explorar lo usa para buscar en catálogos.
  void router.push('/explore')
}

type TypeFilter = MediaType | 'all'
const typeFilter = ref<TypeFilter>('all')
const statusFilter = ref<MediaStatus | 'all'>('all')
/** Sólo las marcadas con ♥ (se combina con el tipo y el estado). */
const favoritesOnly = ref(false)
const favoriteCount = computed(() => entries.value.filter((e) => e.favorite).length)

type SortKey = 'recent' | 'title' | 'rating'
const sortKey = ref<SortKey>('recent')
const sortLabels: Record<SortKey, string> = {
  recent: 'Más recientes',
  title: 'Título (A–Z)',
  rating: 'Mejor calificadas',
}

function cycleSort() {
  const order: SortKey[] = ['recent', 'title', 'rating']
  sortKey.value = order[(order.indexOf(sortKey.value) + 1) % order.length]
}

const visible = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = entries.value.filter((e) => {
    const okType = typeFilter.value === 'all' || e.type === typeFilter.value
    const okStatus = statusFilter.value === 'all' || e.status === statusFilter.value
    const okFavorite = !favoritesOnly.value || e.favorite
    const okSearch =
      !q ||
      e.title.toLowerCase().includes(q) ||
      e.creator.toLowerCase().includes(q) ||
      e.genres.some((g) => g.toLowerCase().includes(q))
    return okType && okStatus && okFavorite && okSearch
  })

  list = [...list]
  if (sortKey.value === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
  else if (sortKey.value === 'rating') list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
  else list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return list
})

const hasActiveFilters = computed(
  () =>
    typeFilter.value !== 'all' || statusFilter.value !== 'all' || favoritesOnly.value || searchQuery.value.trim() !== '',
)

function clearFilters() {
  typeFilter.value = 'all'
  statusFilter.value = 'all'
  favoritesOnly.value = false
  ui.setSearch('')
}

</script>

<template>
  <header class="collection__head">
    <div>
      <h1 class="collection__title">Mi colección</h1>
      <p class="collection__count">
        {{ visible.length }}
        {{ visible.length === 1 ? 'obra' : 'obras' }}
        <template v-if="hasActiveFilters">· filtradas de {{ entries.length }}</template>
      </p>
    </div>
    <BaseButton @click="ui.openCreateEntry()">+ Agregar obra</BaseButton>
  </header>

  <div v-if="loading && !media.loaded" class="collection__grid" aria-busy="true" aria-label="Cargando tu colección">
    <SkeletonCard v-for="n in 8" :key="n" />
  </div>

  <EmptyState
    v-else-if="isEmpty"
    icon="collection"
    title="Tu colección está vacía"
    text="Registra tu primera película, libro, juego o álbum para empezar."
  >
    <BaseButton @click="ui.openCreateEntry()">Agregar obra</BaseButton>
  </EmptyState>

  <template v-else>
    <div class="collection__toolbar">
      <div class="collection__filters">
        <BaseTag :active="typeFilter === 'all'" @click="typeFilter = 'all'">Todo</BaseTag>
        <BaseTag
          v-for="t in MEDIA_TYPES"
          :key="t.value"
          :active="typeFilter === t.value"
          @click="typeFilter = t.value"
        >
          <BaseIcon :name="t.icon" /> {{ t.plural }}
        </BaseTag>
      </div>

      <button type="button" class="collection__sort" @click="cycleSort">
        Orden: <strong>{{ sortLabels[sortKey] }}</strong>
      </button>
    </div>

    <div class="collection__filters">
      <!-- Interruptor aparte (se suma al estado). Sigue visible mientras está activo,
           aunque se quite el último corazón, para poder apagarlo. -->
      <template v-if="favoriteCount || favoritesOnly">
        <BaseTag
          class="collection__fav-filter"
          :active="favoritesOnly"
          @click="favoritesOnly = !favoritesOnly"
        >
          <ToggleIcon :on="favoritesOnly" icon="heart" icon-on="heart-fill" /> Favoritas · {{ favoriteCount }}
        </BaseTag>
        <span class="collection__filters-divider" aria-hidden="true" />
      </template>
      <BaseTag :active="statusFilter === 'all'" @click="statusFilter = 'all'">Cualquier estado</BaseTag>
      <BaseTag
        v-for="s in MEDIA_STATUSES"
        :key="s.value"
        :active="statusFilter === s.value"
        @click="statusFilter = s.value"
      >
        {{ s.label }}
      </BaseTag>
    </div>

    <!-- Al cargar, las tarjetas entran escalonadas; al filtrar u ordenar, las que
         quedan se deslizan a su nuevo lugar (las que salen se van sin animación). -->
    <TransitionGroup v-if="visible.length" tag="div" name="collection-card" appear class="collection__grid">
      <MediaCard
        v-for="(entry, i) in visible"
        :key="entry.id"
        :style="{ '--i': i }"
        :entry="entry"
        @open="ui.openWorkDetail(entry)"
        @toggle-favorite="media.toggleFavorite(entry.id)"
        @edit="ui.openEditEntry(entry.id)"
        @delete="media.deleteEntryWithUndo(entry.id)"
      />
    </TransitionGroup>

    <EmptyState
      v-else-if="searchText"
      compact
      icon="search"
      :title="`No tienes “${searchText}” en tu colección`"
      text="Búscalo en los catálogos de películas, libros, juegos y música para agregarlo."
    >
      <div class="collection__empty-actions">
        <BaseButton @click="searchInCatalogs">Buscar en catálogos</BaseButton>
        <BaseButton variant="outline" @click="clearFilters">Limpiar filtros</BaseButton>
      </div>
    </EmptyState>

    <EmptyState
      v-else
      compact
      icon="search"
      title="Nada coincide con estos filtros"
      text="Ajusta los filtros para ver más resultados."
    >
      <BaseButton variant="outline" @click="clearFilters">Limpiar filtros</BaseButton>
    </EmptyState>
  </template>

</template>

<style scoped>
.collection__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.collection__title {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0;
}

.collection__count {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
  margin: var(--space-xs) 0 0 0;
}

/* Tarjetas: entran escalonadas (hasta la 10.ª; las demás, juntas)… */
.collection-card-enter-active {
  transition:
    opacity 400ms var(--ease-out),
    transform 400ms var(--ease-out);
  transition-delay: calc(min(var(--i, 0), 10) * 40ms);
}

.collection-card-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

/* …y al filtrar u ordenar, las que quedan se deslizan a su nuevo lugar. */
.collection-card-move {
  transition: transform 450ms var(--ease-out);
}

.collection__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.collection__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
}

/* ♥ Favoritas: el corazón hace pop al activarlo (ToggleIcon). */
.collection__fav-filter {
  gap: 6px;
}

/* Separa el interruptor de favoritas de los estados (que son de a uno). */
.collection__filters-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
}

.collection__sort {
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

.collection__sort strong {
  color: var(--color-text);
}

.collection__sort:hover,
.collection__sort:active {
  border-color: var(--color-accent-hover);
}

.collection__empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm);
}

.collection__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
}
</style>
