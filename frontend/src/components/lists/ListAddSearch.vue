<script setup lang="ts">
/**
 * ListAddSearch — buscador para agregar obras a una lista: primero lo que
 * coincide en la colección del usuario y después los catálogos externos.
 * Emite `add` con la obra; `has` dice si ya está en la lista.
 *
 * Uso:
 *   <ListAddSearch :has="yaEsta" @add="agregar" />
 */
import { computed, ref, watch } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import BaseSpinner from '../BaseSpinner.vue'
import { MEDIA_TYPES, typeMeta } from '../../lib/catalog'
import { useDebouncedSearch } from '../../composables/useDebouncedSearch'
import { searchCatalogs } from '../../services/searchService'
import { useMediaStore } from '../../stores/media'
import type { ListWork } from '../../types/list'
import type { MediaType } from '../../types/media'

const props = defineProps<{ has: (work: ListWork) => boolean }>()
const emit = defineEmits<{ add: [work: ListWork] }>()

const media = useMediaStore()
void media.ensureLoaded()

const query = ref('')
const type = ref<MediaType | 'all'>('all')
const { debouncedQuery, isSearching } = useDebouncedSearch(query)

const catalogResults = ref<ListWork[]>([])
const searching = ref(false)
let requestId = 0

watch([debouncedQuery, type], async ([q]) => {
  const text = q.trim()
  catalogResults.value = []
  if (text.length < 2) return
  const current = ++requestId
  searching.value = true
  try {
    const types = type.value === 'all' ? MEDIA_TYPES.map((t) => t.value) : [type.value]
    const groups = await searchCatalogs(types, text)
    if (current !== requestId) return
    catalogResults.value = groups.flatMap((g) =>
      g.results.map((r) => ({
        type: g.type,
        title: r.title,
        creator: r.creator,
        year: r.year,
        cover: r.cover,
        genres: r.genres,
        externalId: r.externalId,
      })),
    )
  } finally {
    if (current === requestId) searching.value = false
  }
})

/** De tu colección: coincidencias por título, sin esperar a los catálogos. */
const fromCollection = computed<ListWork[]>(() => {
  const text = debouncedQuery.value.trim().toLowerCase()
  if (text.length < 2) return []
  return media.entries
    .filter((e) => (type.value === 'all' || e.type === type.value) && e.title.toLowerCase().includes(text))
    .slice(0, 5)
    .map((e) => ({
      type: e.type,
      title: e.title,
      creator: e.creator,
      year: e.year,
      cover: e.cover,
      genres: e.genres,
      externalId: e.externalId,
    }))
})

/** Del catálogo, sin repetir lo que ya salió de la colección. */
const fromCatalogs = computed(() => {
  const seen = new Set(fromCollection.value.map((w) => `${w.type}|${w.externalId ?? w.title.toLowerCase()}`))
  return catalogResults.value.filter((w) => !seen.has(`${w.type}|${w.externalId ?? w.title.toLowerCase()}`))
})

const pending = computed(() => isSearching.value || searching.value)
const hasQuery = computed(() => debouncedQuery.value.trim().length >= 2)
</script>

<template>
  <div class="add-search">
    <div class="add-search__bar">
      <BaseIcon name="search" class="add-search__icon" />
      <input
        v-model="query"
        class="app-input add-search__input"
        placeholder="Busca una película, serie, libro, juego o álbum…"
        aria-label="Buscar obras para agregar"
        autocomplete="off"
      />
      <select v-model="type" class="app-select add-search__type" aria-label="Tipo">
        <option value="all">Todo</option>
        <option v-for="t in MEDIA_TYPES" :key="t.value" :value="t.value">{{ t.plural }}</option>
      </select>
    </div>

    <template v-if="hasQuery">
      <template v-for="group in [
        { label: 'De tu colección', items: fromCollection },
        { label: 'De los catálogos', items: fromCatalogs },
      ]" :key="group.label">
        <div v-if="group.items.length" class="add-search__group">
          <h4 class="add-search__label">{{ group.label }}</h4>
          <ul class="add-search__results">
            <li v-for="w in group.items" :key="`${w.type}|${w.externalId ?? w.title}`" class="add-search__result">
              <img v-if="w.cover" :src="w.cover" alt="" class="add-search__cover" loading="lazy" />
              <span v-else class="add-search__cover add-search__cover--empty" aria-hidden="true">
                <BaseIcon :name="typeMeta(w.type).icon" />
              </span>
              <span class="add-search__info">
                <span class="add-search__title">{{ w.title }}</span>
                <span class="add-search__meta">
                  {{ [typeMeta(w.type).label, w.creator, w.year].filter(Boolean).join(' · ') }}
                </span>
              </span>
              <span v-if="props.has(w)" class="add-search__added"><BaseIcon name="check2" /> En la lista</span>
              <button v-else type="button" class="add-search__add" @click="emit('add', w)">+ Agregar</button>
            </li>
          </ul>
        </div>
      </template>

      <p v-if="pending" class="add-search__hint"><BaseSpinner size="sm" /> Buscando en los catálogos…</p>
      <p v-else-if="!fromCollection.length && !fromCatalogs.length" class="add-search__hint">Sin resultados.</p>
    </template>
  </div>
</template>

<style scoped>
.add-search {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.add-search__bar {
  position: relative;
  display: flex;
  gap: var(--space-sm);
}

.add-search__icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.add-search__input {
  flex: 1;
  padding-left: 36px;
}

.add-search__type {
  width: auto;
}

.add-search__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.add-search__label {
  margin: var(--space-xs) 0 0;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.add-search__results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}

.add-search__result {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px;
  border-radius: var(--radius-md);
}

.add-search__result:hover {
  background: var(--color-surface-2);
}

.add-search__cover {
  width: 32px;
  height: 48px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface-2);
}

.add-search__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
}

.add-search__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.add-search__title {
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-search__meta {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-search__add {
  flex-shrink: 0;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-2);
  color: var(--color-text);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.add-search__add:hover {
  border-color: var(--color-accent);
}

.add-search__added {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-success);
}

.add-search__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}
</style>
