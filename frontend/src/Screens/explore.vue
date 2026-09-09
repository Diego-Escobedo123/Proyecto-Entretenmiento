<script setup lang="ts">
/**
 * Explorar — descubrimiento de contenido por categoría, con "Hidden Gems",
 * ganadores de premios y filtros de refinamiento.
 *
 * TODO(backend): todo hardcodeado a propósito, no hay backend todavía.
 * Cuando exista, reemplazar por:
 *   - hiddenGems -> GET /discover/hidden-gems
 *   - awardWinners -> GET /discover/award-winners
 *   - filtros -> GET /discover?era=&genre=&minRating= con los valores del panel
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseTag from '../components/BaseTag.vue'
import HiddenGemCard from '../components/explore/HiddenGemCard.vue'
import AwardCard from '../components/explore/AwardCard.vue'
import RefineDiscoveryPanel from '../components/explore/RefineDiscoveryPanel.vue'
import EmptyState from '../components/EmptyState.vue'
import { useUiStore } from '../stores/ui'

const { searchQuery } = storeToRefs(useUiStore())

const mediaTabs = ['Todo', 'Cine', 'Literatura', 'Música', 'Artes Visuales']
const activeTab = ref('Todo')

const hiddenGems = [
  {
    kind: 'Cine',
    year: 1973,
    title: 'The Melancholy of Space',
    description:
      'Una obra maestra olvidada del sci-fi soviético, que explora el pavor existencial a través de paisajes glaciales.',
    cover: 'https://picsum.photos/seed/mosaic-melancholy/500/600',
    size: 'lg' as const,
  },
  {
    kind: 'Literatura',
    title: 'Fragments of Time',
    cover: 'https://picsum.photos/seed/mosaic-fragments/300/300',
    size: 'sm' as const,
  },
  {
    kind: 'Música',
    title: 'Midnight Sessions',
    cover: 'https://picsum.photos/seed/mosaic-midnight/300/300',
    size: 'sm' as const,
  },
]

const awardWinners = [
  { title: 'The Architecture...', award: "Palme d'Or · 2023", cover: 'https://picsum.photos/seed/mosaic-award1/300/300' },
  { title: 'Concrete Brutali...', award: 'Best Doc · 2022', cover: 'https://picsum.photos/seed/mosaic-award2/300/300' },
  { title: 'Echoes of Dali', award: 'Visual Arts Prize', cover: 'https://picsum.photos/seed/mosaic-award3/300/300' },
  { title: 'Blue Period Revi...', award: "Curator's Choice", cover: 'https://picsum.photos/seed/mosaic-award4/300/300' },
]

const filteredGems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return hiddenGems
  return hiddenGems.filter((g) => g.title.toLowerCase().includes(q) || g.kind.toLowerCase().includes(q))
})

const filteredAwards = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return awardWinners
  return awardWinners.filter((a) => a.title.toLowerCase().includes(q))
})

const hasResults = computed(() => filteredGems.value.length > 0 || filteredAwards.value.length > 0)

const availableGenres = ['Film Noir', 'Surrealismo', 'Jazz', 'Filosofía']
const activeGenres = ref<string[]>(['Surrealismo'])
const minRating = ref(4)

function toggleGenre(genre: string) {
  activeGenres.value = activeGenres.value.includes(genre)
    ? activeGenres.value.filter((g) => g !== genre)
    : [...activeGenres.value, genre]
}

function applyFilters() {
  // TODO(backend): disparar GET /discover con activeGenres.value y minRating.value
}
</script>

<template>
  <div class="explore">
    <nav class="explore__tabs">
      <BaseTag v-for="tab in mediaTabs" :key="tab" :active="activeTab === tab" @click="activeTab = tab">
        {{ tab }}
      </BaseTag>
    </nav>

    <div class="explore__layout">
      <div class="explore__content">
        <EmptyState
          v-if="!hasResults"
          icon="search"
          title="Sin resultados"
          text="No encontramos nada que coincida con tu búsqueda."
        />

        <template v-else>
          <section v-if="filteredGems.length">
            <h2 class="explore__section-title">💎 Joyas escondidas</h2>
            <div class="explore__gems">
              <HiddenGemCard v-bind="filteredGems[0]" class="explore__gems-main" />
              <div class="explore__gems-side">
                <HiddenGemCard v-for="gem in filteredGems.slice(1)" :key="gem.title" v-bind="gem" />
              </div>
            </div>
          </section>

          <section v-if="filteredAwards.length">
            <div class="explore__section-header">
              <h2 class="explore__section-title">Ganadores de premios</h2>
              <button class="explore__view-all" type="button">Ver todo</button>
            </div>
            <div class="explore__awards">
              <AwardCard v-for="item in filteredAwards" :key="item.title" v-bind="item" />
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
.explore {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.explore__tabs {
  display: flex;
  gap: var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-md);
}

.explore__layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--space-xl);
  align-items: start;
}

.explore__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  min-width: 0;
}

.explore__section-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 var(--space-md) 0;
}

.explore__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.explore__view-all {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.explore__gems {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: var(--space-md);
}

.explore__gems-main {
  height: 100%;
}

.explore__gems-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.explore__awards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

@media (max-width: 960px) {
  .explore__layout {
    grid-template-columns: 1fr;
  }

  .explore__gems {
    grid-template-columns: 1fr;
  }

  .explore__awards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>