<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import SectionHeader from '../components/SectionHeader.vue'
import ListCard from '../components/lists/ListCard.vue'
import EmptyState from '../components/EmptyState.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import { useUiStore } from '../stores/ui'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'

const { searchQuery } = storeToRefs(useUiStore())
const { debouncedQuery, isSearching } = useDebouncedSearch(searchQuery)

const lists = [
  { title: 'Ver en vacaciones', itemCount: 12, visibility: 'public' as const, covers: ['https://picsum.photos/seed/mosaic-list1a/200/200','https://picsum.photos/seed/mosaic-list1b/200/200','https://picsum.photos/seed/mosaic-list1c/200/200','https://picsum.photos/seed/mosaic-list1d/200/200'] },
  { title: 'Esenciales de sci-fi', itemCount: 8, visibility: 'public' as const, covers: ['https://picsum.photos/seed/mosaic-list2a/200/200','https://picsum.photos/seed/mosaic-list2b/200/200','https://picsum.photos/seed/mosaic-list2c/200/200','https://picsum.photos/seed/mosaic-list2d/200/200'] },
  { title: 'Bandas sonoras para escribir', itemCount: 21, visibility: 'private' as const, covers: ['https://picsum.photos/seed/mosaic-list3a/200/200','https://picsum.photos/seed/mosaic-list3b/200/200','https://picsum.photos/seed/mosaic-list3c/200/200','https://picsum.photos/seed/mosaic-list3d/200/200'] },
]

const filteredLists = computed(() => {
  const q = debouncedQuery.value.trim().toLowerCase()
  if (!q) return lists
  return lists.filter((list) => list.title.toLowerCase().includes(q))
})

function onCreateList() {
  // TODO(backend): abrir modal de nueva lista y llamar a listsStore.create(...)
}

function onOpenList(_title: string) {
  // TODO(backend): navegar al detalle de la lista (/lists/:id)
}
</script>

<template>
  <div class="lists-screen">
    <SectionHeader title="Tus listas" link-text="+ Crear lista" @link-click="onCreateList" />

    <div v-if="isSearching" class="lists-screen__searching">
      <BaseSpinner size="sm" /> Buscando…
    </div>

    <EmptyState v-else-if="!filteredLists.length" icon="search" title="Sin resultados" text="No encontramos ninguna lista que coincida con tu búsqueda." />

    <div v-else class="lists-screen__grid">
      <ListCard v-for="list in filteredLists" :key="list.title" v-bind="list" @open="onOpenList(list.title)" />
    </div>
  </div>
</template>

<style scoped>
.lists-screen__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-md); }
.lists-screen__searching { display: flex; align-items: center; gap: var(--space-sm); color: var(--color-text-muted); font-size: 0.9375rem; padding: var(--space-xl) 0; justify-content: center; }
</style>