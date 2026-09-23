<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseTag from '../components/BaseTag.vue'
import HiddenGemCard from '../components/explore/HiddenGemCard.vue'
import AwardCard from '../components/explore/AwardCard.vue'
import RefineDiscoveryPanel from '../components/explore/RefineDiscoveryPanel.vue'
import EmptyState from '../components/EmptyState.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import { useUiStore } from '../stores/ui'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'
import { discoverService } from '../services/discoverService'
import type { AwardWinner, HiddenGem } from '../types/discover'

const { searchQuery } = storeToRefs(useUiStore())
const { debouncedQuery, isSearching: isDebouncing } = useDebouncedSearch(searchQuery)
const isLoading = ref(false)
const isSearching = computed(() => isDebouncing.value || isLoading.value)

const mediaTabs = ['Todo', 'Cine', 'Literatura', 'Música', 'Artes Visuales']
const activeTab = ref('Todo')

const gems = ref<HiddenGem[]>([])
const awards = ref<AwardWinner[]>([])
const hasResults = ref(true)

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

async function loadDiscoverContent() {
  isLoading.value = true
  try {
    const result = await discoverService.get({
      q: debouncedQuery.value,
      ...(filtersApplied.value ? { genres: activeGenres.value, minRating: minRating.value } : {}),
    })
    gems.value = result.hiddenGems
    awards.value = result.awardWinners
    hasResults.value = result.hiddenGems.length > 0 || result.awardWinners.length > 0
  } finally {
    isLoading.value = false
  }
}

function applyFilters() {
  filtersApplied.value = true
  void loadDiscoverContent()
}

watch(debouncedQuery, () => {
  void loadDiscoverContent()
})

onMounted(loadDiscoverContent)
</script>

<template>
  <div class="explore">
    <nav class="explore__tabs">
      <BaseTag v-for="tab in mediaTabs" :key="tab" :active="activeTab === tab" @click="activeTab = tab">{{ tab }}</BaseTag>
    </nav>

    <div class="explore__layout">
      <div class="explore__content">
        <div v-if="isSearching" class="explore__searching">
          <BaseSpinner size="sm" /> Buscando…
        </div>

        <EmptyState v-else-if="!hasResults" icon="search" title="Sin resultados" text="No encontramos nada que coincida con tu búsqueda." />

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
.explore__tabs { display: flex; gap: var(--space-sm); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-md); }
.explore__layout { display: grid; grid-template-columns: 1fr 320px; gap: var(--space-xl); align-items: start; }
.explore__content { display: flex; flex-direction: column; gap: var(--space-xl); min-width: 0; }
.explore__searching { display: flex; align-items: center; gap: var(--space-sm); color: var(--color-text-muted); font-size: 0.9375rem; padding: var(--space-xl) 0; justify-content: center; }
.explore__section-title { font-size: 1.25rem; font-weight: 700; color: var(--color-text); margin: 0 0 var(--space-md) 0; }
.explore__section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md); }
.explore__view-all { background: none; border: none; color: var(--color-accent); font-size: 0.875rem; font-weight: 600; cursor: pointer; }
.explore__gems { display: grid; grid-template-columns: 1.6fr 1fr; gap: var(--space-md); }
.explore__gems-main { height: 100%; }
.explore__gems-side { display: flex; flex-direction: column; gap: var(--space-md); }
.explore__awards { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); }
@media (max-width: 960px) {
  .explore__layout { grid-template-columns: 1fr; }
  .explore__gems { grid-template-columns: 1fr; }
  .explore__awards { grid-template-columns: repeat(2, 1fr); }
}
</style>