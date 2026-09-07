<script setup lang="ts">
/**
 * Listas — colecciones temáticas creadas por el usuario.
 *
 * TODO(backend): hardcodeado a propósito, no hay backend/store de listas
 * todavía. Cuando exista, reemplazar por un useListsStore() análogo a
 * useMediaStore, con CRUD real (crear, renombrar, agregar/quitar obras,
 * cambiar visibilidad).
 */
import SectionHeader from '../components/SectionHeader.vue'
import ListCard from '../components/lists/ListCard.vue'

const lists = [
  {
    title: 'Ver en vacaciones',
    itemCount: 12,
    visibility: 'public' as const,
    covers: [
      'https://picsum.photos/seed/mosaic-list1a/200/200',
      'https://picsum.photos/seed/mosaic-list1b/200/200',
      'https://picsum.photos/seed/mosaic-list1c/200/200',
      'https://picsum.photos/seed/mosaic-list1d/200/200',
    ],
  },
  {
    title: 'Esenciales de sci-fi',
    itemCount: 8,
    visibility: 'public' as const,
    covers: [
      'https://picsum.photos/seed/mosaic-list2a/200/200',
      'https://picsum.photos/seed/mosaic-list2b/200/200',
      'https://picsum.photos/seed/mosaic-list2c/200/200',
      'https://picsum.photos/seed/mosaic-list2d/200/200',
    ],
  },
  {
    title: 'Bandas sonoras para escribir',
    itemCount: 21,
    visibility: 'private' as const,
    covers: [
      'https://picsum.photos/seed/mosaic-list3a/200/200',
      'https://picsum.photos/seed/mosaic-list3b/200/200',
      'https://picsum.photos/seed/mosaic-list3c/200/200',
      'https://picsum.photos/seed/mosaic-list3d/200/200',
    ],
  },
]

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

    <div class="lists-screen__grid">
      <ListCard v-for="list in lists" :key="list.title" v-bind="list" @open="onOpenList(list.title)" />
    </div>
  </div>
</template>

<style scoped>
.lists-screen__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
}
</style>