<script setup lang="ts">
/**
 * GlobalSearch — buscador de la barra superior, disponible en todas las
 * pantallas. El texto vive en `useUiStore().searchQuery`.
 *
 * - En las screens que muestran sus propios resultados (Colección, Listas,
 *   Explorar) sólo actúa como filtro de esa pantalla: no abre desplegable,
 *   para no duplicar lo que ya se ve en la página.
 * - En el resto (Inicio, Perfil) abre un desplegable con coincidencias en la
 *   colección (abrir = editar) y en los catálogos externos (abrir = alta
 *   precargada).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import BaseIcon from './BaseIcon.vue'
import BaseSpinner from './BaseSpinner.vue'
import { MEDIA_TYPES, typeMeta } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'
import { searchCatalogs, type CatalogGroup } from '../services/searchService'
import type { MediaEntry, MediaType } from '../types/media'
import type { ExternalSearchResult } from '../types/search'

/** Screens que filtran su propio contenido con el texto del buscador. */
const PAGE_PLACEHOLDERS: Record<string, string> = {
  collection: 'Buscar en tu colección…',
  lists: 'Buscar en tus listas…',
  explore: 'Buscar en catálogos: películas, libros, juegos, música…',
}
const GLOBAL_PLACEHOLDER = 'Buscar en tu colección y en catálogos…'

const MIN_CHARS = 2
const MAX_LOCAL = 5
const MAX_PER_TYPE = 3

const ui = useUiStore()
const media = useMediaStore()
const route = useRoute()
const router = useRouter()
const { searchQuery } = storeToRefs(ui)

const rootEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const open = ref(false)
const activeIndex = ref(-1)

const routeName = computed(() => String(route.name ?? ''))
/** true en las screens que muestran los resultados en la propia página. */
const isPageSearch = computed(() => routeName.value in PAGE_PLACEHOLDERS)
const placeholder = computed(() => PAGE_PLACEHOLDERS[routeName.value] ?? GLOBAL_PLACEHOLDER)

const trimmed = computed(() => searchQuery.value.trim())
const canSearch = computed(() => !isPageSearch.value && trimmed.value.length >= MIN_CHARS)

// --- Coincidencias en la colección (instantáneas, sin red) ---

const localMatches = computed<MediaEntry[]>(() => {
  if (!canSearch.value) return []
  const q = trimmed.value.toLowerCase()
  return media.entries
    .filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.creator.toLowerCase().includes(q) ||
        e.genres.some((g) => g.toLowerCase().includes(q)),
    )
    .slice(0, MAX_LOCAL)
})

// --- Catálogos externos (con debounce, un request por tipo en paralelo) ---

const externalGroups = ref<CatalogGroup[]>([])
const searchingExternal = ref(false)
let debounceId: ReturnType<typeof setTimeout> | undefined
let requestId = 0

async function runExternalSearch(q: string) {
  const current = ++requestId
  searchingExternal.value = true
  const groups = await searchCatalogs(MEDIA_TYPES.map((t) => t.value), q)
  // Si el usuario siguió escribiendo, esta respuesta ya no sirve.
  if (current !== requestId) return

  // Lo que ya está en la colección sale en su propia sección, no se repite.
  externalGroups.value = groups
    .map((g) => ({
      type: g.type,
      results: g.results.filter((r) => !media.findByTitle(g.type, r.title)).slice(0, MAX_PER_TYPE),
    }))
    .filter((g) => g.results.length > 0)
  searchingExternal.value = false
}

watch([trimmed, canSearch], ([q, enabled], [prevQ]) => {
  activeIndex.value = -1
  if (debounceId) clearTimeout(debounceId)
  if (!enabled) {
    requestId++
    externalGroups.value = []
    searchingExternal.value = false
    return
  }
  // Sólo teclear abre el desplegable; llegar a Inicio con texto ya escrito, no.
  if (q !== prevQ) open.value = true
  searchingExternal.value = true
  debounceId = setTimeout(() => runExternalSearch(q), 400)
})

// --- Navegación con teclado sobre una lista plana de opciones ---

type Option =
  | { kind: 'local'; entry: MediaEntry }
  | { kind: 'external'; type: MediaType; result: ExternalSearchResult }
  | { kind: 'collection' }

const options = computed<Option[]>(() => [
  ...localMatches.value.map((entry) => ({ kind: 'local' as const, entry })),
  ...externalGroups.value.flatMap((g) =>
    g.results.map((result) => ({ kind: 'external' as const, type: g.type, result })),
  ),
  ...(localMatches.value.length ? [{ kind: 'collection' as const }] : []),
])

function indexOf(option: Option): number {
  return options.value.indexOf(option)
}

const externalOptions = computed(() =>
  externalGroups.value.map((g) => ({
    type: g.type,
    items: options.value.filter(
      (o): o is Extract<Option, { kind: 'external' }> => o.kind === 'external' && o.type === g.type,
    ),
  })),
)

const localOptions = computed(() =>
  options.value.filter((o): o is Extract<Option, { kind: 'local' }> => o.kind === 'local'),
)
const collectionOption = computed(() => options.value.find((o) => o.kind === 'collection'))

const showDropdown = computed(() => open.value && canSearch.value)
const hasAnyResult = computed(() => options.value.length > 0)

function close() {
  open.value = false
  activeIndex.value = -1
}

function select(option: Option) {
  if (option.kind === 'local') {
    ui.openEditEntry(option.entry.id)
    ui.setSearch('')
  } else if (option.kind === 'external') {
    const r = option.result
    ui.openCreateEntry({
      type: option.type,
      title: r.title,
      creator: r.creator,
      year: r.year,
      genres: r.genres,
      cover: r.cover,
    })
    ui.setSearch('')
  } else {
    // Mantiene el texto: la pantalla de colección lo usa como filtro.
    void router.push('/collection')
  }
  close()
  inputEl.value?.blur()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()
    return
  }
  if (!showDropdown.value || !options.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % options.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = activeIndex.value <= 0 ? options.value.length - 1 : activeIndex.value - 1
  } else if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault()
    select(options.value[activeIndex.value])
  }
}

function onDocClick(event: MouseEvent) {
  if (open.value && rootEl.value && !rootEl.value.contains(event.target as Node)) close()
}

function metaLine(parts: (string | number | null | undefined)[]): string {
  return parts.filter(Boolean).join(' · ')
}

// Cambiar de pantalla cierra el desplegable (el texto se conserva como filtro).
watch(() => route.fullPath, close)

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  if (debounceId) clearTimeout(debounceId)
})
</script>

<template>
  <div ref="rootEl" class="global-search">
    <div class="global-search__box">
      <span class="global-search__icon"><BaseIcon name="search" /></span>
      <input
        ref="inputEl"
        v-model="searchQuery"
        type="search"
        :placeholder="placeholder"
        class="global-search__input"
        aria-label="Buscar"
        autocomplete="off"
        :role="isPageSearch ? undefined : 'combobox'"
        :aria-expanded="isPageSearch ? undefined : showDropdown"
        @focus="open = true"
        @keydown="onKeydown"
      />
    </div>

    <Transition name="global-search">
      <div v-if="showDropdown" class="global-search__panel" role="listbox">
        <section v-if="localOptions.length" class="global-search__group">
          <h3 class="global-search__group-title">En tu colección</h3>
          <button
            v-for="opt in localOptions"
            :key="opt.entry.id"
            type="button"
            class="global-search__item"
            :class="{ 'is-active': indexOf(opt) === activeIndex }"
            @mouseenter="activeIndex = indexOf(opt)"
            @click="select(opt)"
          >
            <img v-if="opt.entry.cover" :src="opt.entry.cover" alt="" class="global-search__cover" />
            <span v-else class="global-search__cover global-search__cover--empty">
              <BaseIcon :name="typeMeta(opt.entry.type).icon" />
            </span>
            <span class="global-search__text">
              <span class="global-search__title">{{ opt.entry.title }}</span>
              <span class="global-search__meta">
                {{ metaLine([typeMeta(opt.entry.type).label, opt.entry.creator, opt.entry.year]) }}
              </span>
            </span>
            <span class="global-search__action">Editar</span>
          </button>
        </section>

        <section v-for="group in externalOptions" :key="group.type" class="global-search__group">
          <h3 class="global-search__group-title">
            <BaseIcon :name="typeMeta(group.type).icon" /> {{ typeMeta(group.type).plural }}
          </h3>
          <button
            v-for="opt in group.items"
            :key="opt.result.externalId"
            type="button"
            class="global-search__item"
            :class="{ 'is-active': indexOf(opt) === activeIndex }"
            @mouseenter="activeIndex = indexOf(opt)"
            @click="select(opt)"
          >
            <img v-if="opt.result.cover" :src="opt.result.cover" alt="" class="global-search__cover" />
            <span v-else class="global-search__cover global-search__cover--empty">
              <BaseIcon :name="typeMeta(group.type).icon" />
            </span>
            <span class="global-search__text">
              <span class="global-search__title">{{ opt.result.title }}</span>
              <span class="global-search__meta">{{ metaLine([opt.result.creator, opt.result.year]) }}</span>
            </span>
            <span class="global-search__action">+ Agregar</span>
          </button>
        </section>

        <div v-if="searchingExternal" class="global-search__hint">
          <BaseSpinner size="sm" /> Buscando en catálogos…
        </div>
        <p v-else-if="!hasAnyResult" class="global-search__hint">
          Sin resultados para “{{ trimmed }}”.
        </p>

        <button
          v-if="collectionOption"
          type="button"
          class="global-search__footer"
          :class="{ 'is-active': indexOf(collectionOption) === activeIndex }"
          @mouseenter="activeIndex = indexOf(collectionOption)"
          @click="select(collectionOption)"
        >
          Ver todas las coincidencias en Mi colección <BaseIcon name="arrow-right" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.global-search {
  position: relative;
  flex: 1;
  max-width: 480px;
}

.global-search__box {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px var(--space-md);
}

.global-search__box:focus-within {
  border-color: var(--color-accent);
}

.global-search__input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  color: var(--color-text);
  font: inherit;
  font-size: 0.9375rem;
}

.global-search__input::placeholder {
  color: var(--color-text-subtle);
}

.global-search__panel {
  position: absolute;
  top: calc(100% + var(--space-xs));
  left: 0;
  right: 0;
  max-height: min(70vh, 520px);
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  padding: var(--space-xs) 0;
  z-index: 50;
}

.global-search__group + .global-search__group {
  border-top: 1px solid var(--color-border);
}

.global-search__group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: var(--space-sm) var(--space-md) var(--space-xs);
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-subtle);
}

.global-search__item,
.global-search__footer {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: 6px var(--space-md);
  background: none;
  border: none;
  font: inherit;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.global-search__item.is-active,
.global-search__footer.is-active {
  background: var(--color-accent-hover-bg);
  color: var(--color-accent-hover-contrast);
}

.global-search__cover {
  width: 32px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 4px;
  object-fit: cover;
  background: var(--color-surface-2);
}

.global-search__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
}

.global-search__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.global-search__title {
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.global-search__meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.is-active .global-search__meta {
  color: inherit;
  opacity: 0.8;
}

.global-search__action {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-accent);
  opacity: 0;
}

.global-search__item.is-active .global-search__action {
  opacity: 1;
  color: inherit;
}

.global-search__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.global-search__footer {
  justify-content: center;
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-accent);
}

.global-search-enter-active,
.global-search-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.global-search-enter-from,
.global-search-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
