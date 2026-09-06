<script setup lang="ts">
/**
 * Mi colección — grid completo con filtros por tipo y estado, orden y
 * búsqueda global (desde el store de UI). CRUD vía store de media.
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import MediaCard from '../components/MediaCard.vue'
import BaseTag from '../components/BaseTag.vue'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { MEDIA_STATUSES, MEDIA_TYPES } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'
import type { MediaEntry, MediaStatus, MediaType } from '../types/media'

const media = useMediaStore()
const ui = useUiStore()
const { entries, loading, isEmpty } = storeToRefs(media)
const { searchQuery } = storeToRefs(ui)

type TypeFilter = MediaType | 'all'
const typeFilter = ref<TypeFilter>('all')
const statusFilter = ref<MediaStatus | 'all'>('all')

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
    const okSearch =
      !q ||
      e.title.toLowerCase().includes(q) ||
      e.creator.toLowerCase().includes(q) ||
      e.genres.some((g) => g.toLowerCase().includes(q))
    return okType && okStatus && okSearch
  })

  list = [...list]
  if (sortKey.value === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
  else if (sortKey.value === 'rating') list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
  else list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return list
})

const hasActiveFilters = computed(
  () => typeFilter.value !== 'all' || statusFilter.value !== 'all' || searchQuery.value.trim() !== '',
)

function clearFilters() {
  typeFilter.value = 'all'
  statusFilter.value = 'all'
  ui.setSearch('')
}

const pendingDelete = ref<MediaEntry | null>(null)
async function confirmDelete() {
  if (!pendingDelete.value) return
  await media.deleteEntry(pendingDelete.value.id)
  pendingDelete.value = null
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

  <p v-if="loading && !media.loaded" class="collection__loading">Cargando…</p>

  <EmptyState
    v-else-if="isEmpty"
    icon="🗂️"
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
          {{ t.icon }} {{ t.plural }}
        </BaseTag>
      </div>

      <button type="button" class="collection__sort" @click="cycleSort">
        Orden: <strong>{{ sortLabels[sortKey] }}</strong>
      </button>
    </div>

    <div class="collection__filters">
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

    <div v-if="visible.length" class="collection__grid">
      <MediaCard
        v-for="entry in visible"
        :key="entry.id"
        :entry="entry"
        @toggle-favorite="media.toggleFavorite(entry.id)"
        @edit="ui.openEditEntry(entry.id)"
        @delete="pendingDelete = entry"
      />
    </div>

    <EmptyState
      v-else
      compact
      icon="🔍"
      title="Nada coincide con estos filtros"
      text="Ajusta los filtros o la búsqueda para ver más resultados."
    >
      <BaseButton variant="outline" @click="clearFilters">Limpiar filtros</BaseButton>
    </EmptyState>
  </template>

  <ConfirmDialog
    v-if="pendingDelete"
    title="Eliminar obra"
    :message="`¿Eliminar “${pendingDelete.title}”? Esta acción no se puede deshacer.`"
    @confirm="confirmDelete"
    @cancel="pendingDelete = null"
  />
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

.collection__loading {
  color: var(--color-text-muted);
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
  gap: var(--space-sm);
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

.collection__sort:hover {
  border-color: var(--color-accent);
}

.collection__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
}
</style>
