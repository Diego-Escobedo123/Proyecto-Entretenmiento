<script setup lang="ts">
/**
 * ExploreRow — una sección de Explorar como fila con scroll horizontal.
 * Carga su propia sección (cada fila aparece en cuanto llega, sin esperar a
 * las demás) y se oculta si no hay nada que mostrar para ese tipo.
 *
 * Uso:
 *   <ExploreRow section="trending" :type="tipoActivo" title="Tendencias" icon="fire" />
 */
import { computed, ref, watch } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import CatalogResultCard from './CatalogResultCard.vue'
import { exploreService } from '../../services/exploreService'
import { useMediaStore } from '../../stores/media'
import { useUiStore } from '../../stores/ui'
import type { ExploreItem, ExploreSection } from '../../types/explore'
import type { MediaType } from '../../types/media'

const props = defineProps<{
  section: ExploreSection
  type: MediaType | null
  title: string
  icon: string
  subtitle?: string
}>()

const media = useMediaStore()
const ui = useUiStore()

const items = ref<ExploreItem[]>([])
const loading = ref(true)
let requestId = 0

async function load() {
  const current = ++requestId
  loading.value = true
  try {
    const res = await exploreService.section(props.section, props.type)
    if (current === requestId) items.value = res
  } catch {
    if (current === requestId) items.value = []
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(() => props.type, load, { immediate: true })

const visible = computed(() => loading.value || items.value.length > 0)

const owned = (i: ExploreItem) => media.findByTitle(i.type, i.title, i.externalId)
const toWork = (i: ExploreItem) => ({
  type: i.type,
  title: i.title,
  creator: i.creator,
  year: i.year,
  genres: i.genres,
  cover: i.cover,
  externalId: i.externalId,
})

function openOwned(i: ExploreItem) {
  const entry = owned(i)
  if (entry) ui.openEditEntry(entry.id)
}

// --- Flechas de desplazamiento (en táctil basta con deslizar) ---
const track = ref<HTMLElement | null>(null)
function scroll(direction: -1 | 1) {
  const el = track.value
  if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
}
</script>

<template>
  <section v-if="visible" class="explore-row">
    <header class="explore-row__head">
      <div>
        <h2 class="explore-row__title"><BaseIcon :name="icon" /> {{ title }}</h2>
        <p v-if="subtitle" class="explore-row__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="!loading" class="explore-row__arrows">
        <button type="button" class="explore-row__arrow" aria-label="Anteriores" @click="scroll(-1)">
          <BaseIcon name="chevron-left" />
        </button>
        <button type="button" class="explore-row__arrow" aria-label="Siguientes" @click="scroll(1)">
          <BaseIcon name="chevron-right" />
        </button>
      </div>
    </header>

    <div ref="track" class="explore-row__track" :aria-busy="loading">
      <template v-if="loading">
        <div v-for="n in 6" :key="n" class="explore-row__skeleton" aria-hidden="true" />
      </template>
      <CatalogResultCard
        v-for="item in items"
        v-else
        :key="`${item.type}|${item.externalId}`"
        class="explore-row__card"
        :result="item"
        :type="item.type"
        :owned="!!owned(item)"
        :note="item.note"
        :rating="item.rating"
        :show-type="!type"
        @add="ui.openCreateEntry(toWork(item))"
        @open="openOwned(item)"
        @details="ui.openWorkDetail(toWork(item))"
      />
    </div>
  </section>
</template>

<style scoped>
.explore-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

.explore-row__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md);
}

.explore-row__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.explore-row__subtitle {
  margin: 2px 0 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.explore-row__arrows {
  display: flex;
  gap: 6px;
}

.explore-row__arrow {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}

.explore-row__arrow:hover {
  border-color: var(--color-accent);
}

.explore-row__track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 160px;
  gap: var(--space-md);
  overflow-x: auto;
  scroll-snap-type: x proximity;
  padding-bottom: var(--space-sm);
  scrollbar-width: thin;
}

.explore-row__card {
  scroll-snap-align: start;
}

.explore-row__skeleton {
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  animation: explore-row-pulse 1.2s ease-in-out infinite alternate;
}

@keyframes explore-row-pulse {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 480px) {
  .explore-row__track {
    grid-auto-columns: 130px;
  }

  .explore-row__arrows {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .explore-row__skeleton {
    animation: none;
  }
}
</style>
