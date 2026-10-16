<script setup lang="ts">
/**
 * Explorar — dos modos según el buscador de la barra superior:
 * - sin texto: secciones con datos reales (`/explore`): Para ti, Tendencias,
 *   Estrenos y próximos, Joyas escondidas y Popular en Mosaic. Cada sección
 *   carga por su cuenta y se oculta si no tiene nada para el tipo elegido;
 * - con texto: resultados de los catálogos externos (`/search`), con opción
 *   de agregar cada obra a la colección.
 * Las pestañas filtran por tipo de obra en ambos modos.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from '../components/BaseIcon.vue'
import CatalogResultCard from '../components/explore/CatalogResultCard.vue'
import ExploreRow from '../components/explore/ExploreRow.vue'
import ExploreGems from '../components/explore/ExploreGems.vue'
import EmptyState from '../components/EmptyState.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import { MEDIA_TYPES, typeMeta } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'
import { useSlidingIndicator } from '../composables/useSlidingIndicator'
import { searchCatalogs, type CatalogGroup } from '../services/searchService'
import type { MediaType } from '../types/media'
import type { ExternalSearchResult } from '../types/search'

const ui = useUiStore()
const media = useMediaStore()
const { searchQuery } = storeToRefs(ui)
const { debouncedQuery, isSearching: isDebouncing } = useDebouncedSearch(searchQuery)
const isLoading = ref(false)
const isSearching = computed(() => isDebouncing.value || isLoading.value)

const mediaTabs: { label: string; value: MediaType | null; icon: string }[] = [
  { label: 'Todo', value: null, icon: 'grid' },
  { label: 'Cine', value: 'movie', icon: typeMeta('movie').icon },
  { label: 'Series', value: 'series', icon: typeMeta('series').icon },
  { label: 'Literatura', value: 'book', icon: typeMeta('book').icon },
  { label: 'Videojuegos', value: 'game', icon: typeMeta('game').icon },
  { label: 'Música', value: 'music', icon: typeMeta('music').icon },
]
const activeType = ref<MediaType | null>(null)

/** Pastilla dorada que se desliza a la pestaña elegida. */
const tabsEl = ref<HTMLElement | null>(null)
const { style: pillStyle, ready: pillReady } = useSlidingIndicator(tabsEl, '.explore__tab.is-active', activeType)

/** Con 2+ caracteres se busca en los catálogos externos en vez del curado. */
const catalogQuery = computed(() => {
  const q = debouncedQuery.value.trim()
  return q.length >= 2 ? q : ''
})
const isCatalogMode = computed(() => catalogQuery.value !== '')

// --- Secciones (/explore): textos según la pestaña ---

/** Cómo se dice "ver/leer/jugar/escuchar" en cada pestaña, para los subtítulos. */
const CONSUME: Record<MediaType | 'all', string> = {
  all: 'se está viendo, leyendo, jugando y escuchando',
  movie: 'se está viendo en cine y streaming',
  series: 'se está viendo en series',
  book: 'se está leyendo',
  game: 'se está jugando',
  music: 'se está escuchando en tu país',
}
const consume = computed(() => CONSUME[activeType.value ?? 'all'])

// --- Catálogos externos (/search) ---

const catalogGroups = ref<CatalogGroup[]>([])

function fetchCatalogResults() {
  const types = activeType.value ? [activeType.value] : MEDIA_TYPES.map((t) => t.value)
  return searchCatalogs(types, catalogQuery.value)
}

function toWork(type: MediaType, r: ExternalSearchResult) {
  return {
    type,
    title: r.title,
    creator: r.creator,
    year: r.year,
    genres: r.genres,
    cover: r.cover,
    externalId: r.externalId,
  }
}

function findOwned(type: MediaType, r: ExternalSearchResult) {
  return media.findByTitle(type, r.title, r.externalId)
}

function addToCollection(type: MediaType, r: ExternalSearchResult) {
  ui.openCreateEntry(toWork(type, r))
}

function openOwned(type: MediaType, r: ExternalSearchResult) {
  const entry = findOwned(type, r)
  if (entry) ui.openEditEntry(entry.id)
}

/** Ficha de la obra con las reseñas de la comunidad. */
function openDetails(type: MediaType, r: ExternalSearchResult) {
  ui.openWorkDetail(toWork(type, r))
}

// --- Carga según el modo; ignora respuestas viejas si el usuario cambió algo ---

let requestId = 0

/** Sólo el modo búsqueda carga aquí; las secciones cargan cada una por su cuenta. */
async function load() {
  if (!isCatalogMode.value) return
  const current = ++requestId
  isLoading.value = true
  try {
    const groups = await fetchCatalogResults()
    if (current === requestId) catalogGroups.value = groups
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
    <!-- Filtro por tipo: control segmentado; en pantallas angostas se desplaza en horizontal. -->
    <nav class="explore__filters" aria-label="Filtrar por tipo de obra">
      <div ref="tabsEl" class="explore__tabs" role="group">
        <span class="explore__pill" :class="{ 'is-ready': pillReady }" :style="pillStyle" aria-hidden="true" />
        <button
          v-for="tab in mediaTabs"
          :key="tab.label"
          type="button"
          class="explore__tab"
          :class="{ 'is-active': activeType === tab.value }"
          :aria-pressed="activeType === tab.value"
          @click="activeType = tab.value"
        >
          <BaseIcon :name="tab.icon" /> {{ tab.label }}
        </button>
      </div>
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
              v-for="(r, i) in group.results"
              :key="r.externalId"
              class="mosaic-enter"
              :style="{ '--i': i }"
              :result="r"
              :type="group.type"
              :owned="!!findOwned(group.type, r)"
              @add="addToCollection(group.type, r)"
              @open="openOwned(group.type, r)"
              @details="openDetails(group.type, r)"
            />
          </div>
        </section>
      </template>
    </div>

    <!-- Modo descubrimiento: secciones con datos reales -->
    <div v-else class="explore__content">
      <ExploreRow
        section="foryou"
        :type="activeType"
        title="Para ti"
        icon="stars"
        subtitle="A partir de lo que más te gustó de tu colección."
      />
      <ExploreRow
        section="trending"
        :type="activeType"
        title="Tendencias"
        icon="fire"
        :subtitle="`Lo que más ${consume} esta semana.`"
      />
      <ExploreRow
        section="upcoming"
        :type="activeType"
        title="Estrenos y próximos"
        icon="calendar-event"
        subtitle="Lo que está por salir y lo que acaba de salir."
      />
      <ExploreGems :type="activeType" />
      <ExploreRow
        section="community"
        :type="activeType"
        title="Popular en Mosaic"
        icon="people"
        subtitle="Lo que más registra la gente de la app."
      />
    </div>
  </div>
</template>

<style scoped>
.explore { display: flex; flex-direction: column; gap: var(--space-xl); }
.explore__filters { display: flex; min-width: 0; }
.explore__tabs {
  position: relative;
  display: flex;
  gap: var(--space-xs);
  max-width: 100%;
  padding: var(--space-xs);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  overflow-x: auto;
  scrollbar-width: none;
}
.explore__tabs::-webkit-scrollbar { display: none; }
.explore__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-radius: 999px;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  /* Por encima de la pastilla deslizante. */
  position: relative;
  transition: background var(--dur-fast) ease, color var(--dur-base) ease;
}
.explore__tab:hover { background: var(--color-accent-hover-bg); color: var(--color-text); }
.explore__tab:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
/* El fondo dorado lo pone la pastilla deslizante; aquí sólo el texto. */
.explore__tab.is-active,
.explore__tab.is-active:hover {
  background: transparent;
  color: var(--color-accent-contrast);
}
.explore__pill {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 999px;
  background: var(--color-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.explore__pill.is-ready {
  transition: transform var(--dur-base) var(--ease-out), width var(--dur-base) var(--ease-out), opacity var(--dur-fast) ease;
}
.explore__content { display: flex; flex-direction: column; gap: var(--space-xl); min-width: 0; }
.explore__searching { display: flex; align-items: center; gap: var(--space-sm); color: var(--color-text-muted); font-size: 0.9375rem; padding: var(--space-xl) 0; justify-content: center; }
.explore__results-heading { margin: 0; color: var(--color-text-muted); font-size: 0.9375rem; }
.explore__results-heading strong { color: var(--color-text); }
.explore__section-title { display: flex; align-items: center; gap: var(--space-sm); font-size: 1.25rem; font-weight: 700; color: var(--color-text); margin: 0 0 var(--space-md) 0; }
.explore__catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--space-lg) var(--space-md); }
@media (max-width: 480px) {
  .explore__catalog-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
