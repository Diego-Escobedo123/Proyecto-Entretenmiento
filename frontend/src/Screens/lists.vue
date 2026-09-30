<script setup lang="ts">
/**
 * Listas — las listas del usuario (como las de Letterboxd). Se crean aquí o
 * desde la ficha de cualquier obra ("Agregar a lista"). La búsqueda global
 * filtra por nombre o descripción. La wishlist va siempre primero, fija.
 */
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import SectionHeader from '../components/SectionHeader.vue'
import ListCard from '../components/lists/ListCard.vue'
import WishlistCard from '../components/lists/WishlistCard.vue'
import ListFormModal from '../components/lists/ListFormModal.vue'
import EmptyState from '../components/EmptyState.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import { useUiStore } from '../stores/ui'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'
import { listService } from '../services/listService'
import type { ListSummary } from '../types/list'

const router = useRouter()
const { searchQuery } = storeToRefs(useUiStore())
const { debouncedQuery, isSearching } = useDebouncedSearch(searchQuery)

const lists = ref<ListSummary[]>([])
const loading = ref(true)
const failed = ref(false)

onMounted(async () => {
  try {
    lists.value = await listService.mine()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

const filteredLists = computed(() => {
  const q = debouncedQuery.value.trim().toLowerCase()
  if (!q) return lists.value
  return lists.value.filter(
    (list) => list.title.toLowerCase().includes(q) || list.description.toLowerCase().includes(q),
  )
})

/** La wishlist se oculta al buscar, salvo que se busque por su nombre. */
const showWishlist = computed(() => {
  const q = debouncedQuery.value.trim().toLowerCase()
  return !q || 'wishlist'.includes(q)
})

const creating = ref(false)

/** Recién creada: se abre para empezar a llenarla. */
function onCreated(list: ListSummary) {
  lists.value = [list, ...lists.value]
  void router.push(`/lists/${list.id}`)
}
</script>

<template>
  <div class="lists-screen">
    <SectionHeader title="Tus listas" link-text="+ Crear lista" @link-click="creating = true" />

    <div v-if="loading || isSearching" class="lists-screen__searching">
      <BaseSpinner size="sm" /> {{ loading ? 'Cargando tus listas…' : 'Buscando…' }}
    </div>

    <p v-else-if="failed" class="lists-screen__searching">No se pudieron cargar tus listas.</p>

    <template v-else>
      <div v-if="showWishlist || filteredLists.length" class="lists-screen__grid">
        <WishlistCard v-if="showWishlist" />
        <ListCard v-for="list in filteredLists" :key="list.id" :list="list" />
      </div>

      <EmptyState
        v-if="!lists.length"
        compact
        icon="card-list"
        title="Aún no tienes listas propias"
        text="Arma listas de lo que quieras: pendientes para vacaciones, tus 10 favoritos, sagas completas… Pueden incluir obras que todavía no has visto."
      >
        <BaseButton @click="creating = true">Crear mi primera lista</BaseButton>
      </EmptyState>

      <EmptyState
        v-else-if="!filteredLists.length && !showWishlist"
        icon="search"
        title="Sin resultados"
        text="No encontramos ninguna lista que coincida con tu búsqueda."
      />
    </template>

    <ListFormModal v-if="creating" @close="creating = false" @saved="onCreated" />
  </div>
</template>

<style scoped>
.lists-screen { display: flex; flex-direction: column; gap: var(--space-lg); }
.lists-screen__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-md); }
.lists-screen__searching { display: flex; align-items: center; gap: var(--space-sm); color: var(--color-text-muted); font-size: 0.9375rem; padding: var(--space-xl) 0; justify-content: center; }
</style>
