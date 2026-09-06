/**
 * Store de obras: única fuente de verdad para la colección en toda la app.
 * Las screens leen `entries` / getters y llaman a las acciones; nunca tocan
 * el servicio ni localStorage directamente.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { mediaService } from '../services/mediaService'
import type { MediaEntry, MediaEntryInput, MediaType } from '../types/media'

export const useMediaStore = defineStore('media', () => {
  const entries = ref<MediaEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  /** Carga inicial idempotente: se puede llamar desde cada screen sin recargar dos veces. */
  async function ensureLoaded(): Promise<void> {
    if (loaded.value || loading.value) return
    await fetchAll()
  }

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      entries.value = await mediaService.list()
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'No se pudo cargar la colección'
    } finally {
      loading.value = false
    }
  }

  async function addEntry(input: MediaEntryInput): Promise<MediaEntry> {
    const created = await mediaService.create(input)
    entries.value = [created, ...entries.value]
    return created
  }

  async function editEntry(id: string, patch: Partial<MediaEntryInput>): Promise<void> {
    const updated = await mediaService.update(id, patch)
    entries.value = entries.value.map((e) => (e.id === id ? updated : e))
  }

  async function deleteEntry(id: string): Promise<void> {
    await mediaService.remove(id)
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  async function toggleFavorite(id: string): Promise<void> {
    const entry = entries.value.find((e) => e.id === id)
    if (!entry) return
    await editEntry(id, { favorite: !entry.favorite })
  }

  const isEmpty = computed(() => loaded.value && entries.value.length === 0)

  const countByType = computed<Record<MediaType, number>>(() => {
    const acc: Record<MediaType, number> = { movie: 0, book: 0, game: 0, music: 0 }
    for (const e of entries.value) acc[e.type]++
    return acc
  })

  const favorites = computed(() => entries.value.filter((e) => e.favorite))

  const completedCount = computed(
    () => entries.value.filter((e) => e.status === 'completed').length,
  )
  const inProgressCount = computed(
    () => entries.value.filter((e) => e.status === 'in-progress').length,
  )

  /** Todos los géneros presentes en la colección, ordenados por frecuencia. */
  const allGenres = computed(() => {
    const tally = new Map<string, number>()
    for (const e of entries.value) {
      for (const g of e.genres) tally.set(g, (tally.get(g) ?? 0) + 1)
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g)
  })

  function getById(id: string): MediaEntry | undefined {
    return entries.value.find((e) => e.id === id)
  }

  return {
    entries,
    loading,
    error,
    loaded,
    isEmpty,
    countByType,
    favorites,
    completedCount,
    inProgressCount,
    allGenres,
    ensureLoaded,
    fetchAll,
    addEntry,
    editEntry,
    deleteEntry,
    toggleFavorite,
    getById,
  }
})
