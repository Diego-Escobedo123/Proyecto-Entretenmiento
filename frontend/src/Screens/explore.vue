<script setup lang="ts">
/**
 * Explorar — dos modos según el buscador de la barra superior:
 * - sin texto: catálogo curado (`/discover`: joyas escondidas y premios);
 * - con texto: resultados de los catálogos externos (`/search`), con opción
 *   de agregar cada obra a la colección.
 * Las pestañas filtran por tipo de obra en ambos modos.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseTag from '../components/BaseTag.vue'
import BaseIcon from '../components/BaseIcon.vue'
import HiddenGemCard from '../components/explore/HiddenGemCard.vue'
import AwardCard from '../components/explore/AwardCard.vue'
import CatalogResultCard from '../components/explore/CatalogResultCard.vue'
import RefineDiscoveryPanel from '../components/explore/RefineDiscoveryPanel.vue'
import EmptyState from '../components/EmptyState.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import { MEDIA_TYPES, typeMeta } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'
import { discoverService } from '../services/discoverService'
import { searchCatalogs, type CatalogGroup } from '../services/searchService'
import type { AwardWinner, HiddenGem } from '../types/discover'
import type { MediaType } from '../types/media'
import type { ExternalSearchResult } from '../types/search'

const ui = useUiStore()
const media = useMediaStore()
const { searchQuery } = storeToRefs(ui)
const { debouncedQuery, isSearching: isDebouncing } = useDebouncedSearch(searchQuery)
const isLoading = ref(false)
const isSearching = computed(() => isDebouncing.value || isLoading.value)

const mediaTabs: { label: string; value: MediaType | null }[] = [
  { label: 'Todo', value: null },
  { label: 'Cine', value: 'movie' },
  { label: 'Literatura', value: 'book' },
  { label: 'Videojuegos', value: 'game' },
  { label: 'Música', value: 'music' },
]
const activeType = ref<MediaType | null>(null)

/** Con 2+ caracteres se busca en los catálogos externos en vez del curado. */
const catalogQuery = computed(() => {
  const q = debouncedQuery.value.trim()
  return q.length >= 2 ? q : ''
})
const isCatalogMode = computed(() => catalogQuery.value !== '')

// --- Catálogo curado (/discover) ---

const gems = ref<HiddenGem[]>([])
const awards = ref<AwardWinner[]>([])
const hasCuratedResults = computed(() => gems.value.length > 0 || awards.value.length > 0)

const availableGenres = ['Film Noir', 'Surrealismo', 'Jazz', 'Filosofía']
const activeGenres = ref<string[]>(['Surrealismo'])
const minRating = ref(4)

function toggleGenre(genre: string) {
  activeGenres.value = activeGenres.value.includes(genre)
    ? activeGenres.value.filter((g) => g !== genre)
    : [...activeGenres.value, genre]
}

// Los filtros de género/rating sólo se mandan al backend después de que el
// usuario los aplique explícitamente (botón "Aplicar filtros"); si no, el
// estado inicial del panel (p. ej. "Surrealismo" preseleccionado) ocultaría
// la mayor parte del catálogo desde el primer render.
const filtersApplied = ref(false)

function fetchDiscoverContent() {
  return discoverService.get({
    type: activeType.value ?? undefined,
    ...(filtersApplied.value ? { genres: activeGenres.value, minRating: minRating.value } : {}),
  })
}

function applyFilters() {
  filtersApplied.value = true
  void load()
}

// --- Catálogos externos (/search) ---

const catalogGroups = ref<CatalogGroup[]>([])

function fetchCatalogResults() {
  const types = activeType.value ? [activeType.value] : MEDIA_TYPES.map((t) => t.value)
  return searchCatalogs(types, catalogQuery.value)
}

function addToCollection(type: MediaType, r: ExternalSearchResult) {
  ui.openCreateEntry({
    type,
    title: r.title,
    creator: r.creator,
    year: r.year,
    genres: r.genres,
    cover: r.cover,
  })
}

function openOwned(type: MediaType, r: ExternalSearchResult) {
  const entry = media.findByTitle(type, r.title)
  if (entry) ui.openEditEntry(entry.id)
}

// --- Carga según el modo; ignora respuestas viejas si el usuario cambió algo ---

let requestId = 0

async function load() {
  const current = ++requestId
  isLoading.value = true
  try {
    if (isCatalogMode.value) {
      const groups = await fetchCatalogResults()
      if (current === requestId) catalogGroups.value = groups
    } else {
      const result = await fetchDiscoverContent()
      if (current === requestId) {
        gems.value = result.hiddenGems
        awards.value = result.awardWinners
      }
    }
  } finally {
    if (current === requestId) isLoading.value = false
  }
}

watch([catalogQuery, activeType], () => {
  void load()
})

onMounted(() => {
  void media.ensureLoaded()
  void load()
})
</script>

<template>
  <div class="explore">
    <nav class="explore__tabs">
      <BaseTag
        v-for="tab in mediaTabs"
        :key="tab.label"
        :active="activeType === tab.value"
        @click="activeType = tab.value"
      >
        <BaseIcon v-if="tab.value" :name="typeMeta(tab.value).icon" /> {{ tab.label }}
      </BaseTag>
    </nav>

    <!-- Modo búsqueda: resultados de los catálogos externos -->
    <div v-if="isCatalogMode || (isSearching && searchQuery.trim().length >= 2)" class="explore__content">
      <p v-if="!isSearching" class="explore__results-heading">
        Resultados en catálogos para <strong>“{{ catalogQuery }}”</strong>
      </p>

      <div v-if="isSearching" class="explore__searching">
        <BaseSpinner size="sm" /> Buscando en catálogos…
      </div>

      <EmptyState
        v-else-if="!catalogGroups.length"
        icon="search"
        title="Sin resultados"
        text="No encontramos obras con ese nombre. Prueba con otro título o cambia de pestaña."
      />

      <template v-else>
        <section v-for="group in catalogGroups" :key="group.type">
          <h2 v-if="!activeType" class="explore__section-title">
            <BaseIcon :name="typeMeta(group.type).icon" /> {{ typeMeta(group.type).plural }}
          </h2>
          <div class="explore__catalog-grid">
            <CatalogResultCard
              v-for="r in group.results"
              :key="r.externalId"
              :result="r"
              :type="group.type"
              :owned="!!media.findByTitle(group.type, r.title)"
              @add="addToCollection(group.type, r)"
              @open="openOwned(group.type, r)"
            />
          </div>
        </section>
      </template>
    </div>

    <!-- Modo descubrimiento: catálogo curado -->
    <div v-else class="explore__layout">
      <div class="explore__content">
        <div v-if="isSearching" class="explore__searching">
          <BaseSpinner size="sm" /> Cargando…
        </div>

        <EmptyState
          v-else-if="!hasCuratedResults"
          icon="compass"
          title="Nada por aquí todavía"
          text="No hay obras destacadas para este filtro. Usa el buscador de arriba para explorar los catálogos completos."
        />

        <template v-else>
          <section v-if="gems.length">
            <h2 class="explore__section-title">💎 Joyas escondidas</h2>
            <div class="explore__gems">
              <HiddenGemCard v-bind="gems[0]" class="explore__gems-main" />
              <div class="explore__gems-side">
                <HiddenGemCard v-for="gem in gems.slice(1)" :key="gem.id" v-bind="gem" />
              </div>
            </div>
          </section>

          <section v-if="awards.length">
            <div class="explore__section-header">
              <h2 class="explore__section-title">Ganadores de premios</h2>
              <button class="explore__view-all" type="button">Ver todo</button>
            </div>
            <div class="explore__awards">
              <AwardCard v-for="item in awards" :key="item.id" v-bind="item" />
            </div>
          </section>
        </template>
      </div>

      <RefineDiscoveryPanel
        :genres="availableGenres"
        :active-genres="activeGenres"
        :min-rating="minRating"
        @toggle-genre="toggleGenre"
        @update:min-rating="minRating = $event"
        @apply="applyFilters"
      />
    </div>
  </div>
</template>

<style scoped>
.explore { display: flex; flex-direction: column; gap: var(--space-xl); }
.explore__tabs { display: flex; flex-wrap: wrap; gap: var(--space-sm); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-md); }
.explore__layout { display: grid; grid-template-columns: 1fr 320px; gap: var(--space-xl); align-items: start; }
.explore__content { display: flex; flex-direction: column; gap: var(--space-xl); min-width: 0; }
.explore__searching { display: flex; align-items: center; gap: var(--space-sm); color: var(--color-text-muted); font-size: 0.9375rem; padding: var(--space-xl) 0; justify-content: center; }
.explore__results-heading { margin: 0; color: var(--color-text-muted); font-size: 0.9375rem; }
.explore__results-heading strong { color: var(--color-text); }
.explore__section-title { display: flex; align-items: center; gap: var(--space-sm); font-size: 1.25rem; font-weight: 700; color: var(--color-text); margin: 0 0 var(--space-md) 0; }
.explore__section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md); }
.explore__view-all { background: none; border: none; color: var(--color-accent); font-size: 0.875rem; font-weight: 600; cursor: pointer; }
.explore__gems { display: grid; grid-template-columns: 1.6fr 1fr; gap: var(--space-md); }
.explore__gems-main { height: 100%; }
.explore__gems-side { display: flex; flex-direction: column; gap: var(--space-md); }
.explore__awards { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); }
.explore__catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--space-lg) var(--space-md); }
@media (max-width: 960px) {
  .explore__layout { grid-template-columns: 1fr; }
  .explore__gems { grid-template-columns: 1fr; }
  .explore__awards { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .explore__catalog-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
