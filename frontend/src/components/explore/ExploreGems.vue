<script setup lang="ts">
/**
 * ExploreGems — Joyas escondidas: obras muy bien calificadas pero poco
 * conocidas (datos reales de TMDB y RAWG). Una destacada grande con su
 * sinopsis y cuatro más al lado. Cambian cada día. No aparece para libros y
 * música (no hay fuente confiable de "poco conocidas").
 *
 * Uso:
 *   <ExploreGems :type="tipoActivo" />
 */
import { computed, ref, watch } from 'vue'
import HiddenGemCard from './HiddenGemCard.vue'
import { typeMeta } from '../../lib/catalog'
import { exploreService } from '../../services/exploreService'
import { useUiStore } from '../../stores/ui'
import type { ExploreItem } from '../../types/explore'
import type { MediaType } from '../../types/media'

const props = defineProps<{ type: MediaType | null }>()
const ui = useUiStore()

const gems = ref<ExploreItem[]>([])
const loading = ref(true)
let requestId = 0

watch(
  () => props.type,
  async () => {
    const current = ++requestId
    loading.value = true
    try {
      const res = await exploreService.section('gems', props.type)
      // La destacada necesita sinopsis; el resto sólo portada.
      const withCover = res.filter((g) => g.cover)
      const featured = withCover.find((g) => g.description) ?? withCover[0]
      if (current === requestId) gems.value = featured ? [featured, ...withCover.filter((g) => g !== featured)].slice(0, 5) : []
    } catch {
      if (current === requestId) gems.value = []
    } finally {
      if (current === requestId) loading.value = false
    }
  },
  { immediate: true },
)

const featured = computed(() => gems.value[0])
const rest = computed(() => gems.value.slice(1))

function open(g: ExploreItem) {
  ui.openWorkDetail({
    type: g.type,
    title: g.title,
    creator: g.creator,
    year: g.year,
    genres: g.genres,
    cover: g.cover,
    externalId: g.externalId,
  })
}

const kind = (g: ExploreItem) => [typeMeta(g.type).label, g.note].filter(Boolean).join(' · ')
</script>

<template>
  <section v-if="loading || gems.length" class="gems">
    <header>
      <h2 class="gems__title">💎 Joyas escondidas</h2>
      <p class="gems__subtitle">Muy bien calificadas y poco conocidas. Cambian cada día.</p>
    </header>

    <div v-if="loading" class="gems__grid" aria-busy="true">
      <div class="gems__skeleton gems__skeleton--lg" />
      <div class="gems__side">
        <div v-for="n in 4" :key="n" class="gems__skeleton" />
      </div>
    </div>

    <div v-else-if="featured" class="gems__grid">
      <HiddenGemCard
        :kind="kind(featured)"
        :year="featured.year ?? undefined"
        :title="featured.title"
        :description="featured.description"
        :cover="featured.cover!"
        size="lg"
        @open="open(featured)"
      />
      <div v-if="rest.length" class="gems__side">
        <HiddenGemCard
          v-for="g in rest"
          :key="g.externalId"
          :kind="kind(g)"
          :title="g.title"
          :cover="g.cover!"
          @open="open(g)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.gems {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.gems__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.gems__subtitle {
  margin: 2px 0 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.gems__grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: var(--space-md);
}

.gems__side {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.gems__skeleton {
  min-height: 160px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-2);
}

.gems__skeleton--lg {
  min-height: 340px;
}

@media (max-width: 960px) {
  .gems__grid {
    grid-template-columns: 1fr;
  }
}
</style>
