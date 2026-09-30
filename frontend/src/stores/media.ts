/**
 * Store de obras: única fuente de verdad para la colección en toda la app.
 * Las screens leen `entries` / getters y llaman a las acciones; nunca tocan
 * el servicio ni localStorage directamente.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { mediaService, type MediaWriteOptions } from '../services/mediaService'
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

  async function addEntry(input: MediaEntryInput, options?: MediaWriteOptions): Promise<MediaEntry> {
    const created = await mediaService.create(input, options)
    entries.value = [created, ...entries.value]
    return created
  }

  async function editEntry(id: string, patch: Partial<MediaEntryInput>, options?: MediaWriteOptions): Promise<void> {
    const updated = await mediaService.update(id, patch, options)
    entries.value = entries.value.map((e) => (e.id === id ? updated : e))
  }

  /** Vuelve a leer una obra del backend (p. ej. después de registrarla otra vez en el diario). */
  async function reloadEntry(id: string): Promise<void> {
    const fresh = await mediaService.get(id)
    if (fresh) entries.value = entries.value.map((e) => (e.id === id ? fresh : e))
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
    const acc: Record<MediaType, number> = { movie: 0, series: 0, book: 0, game: 0, music: 0 }
    for (const e of entries.value) acc[e.type]++
    return acc
  })

  function getById(id: string): MediaEntry | undefined {
    return entries.value.find((e) => e.id === id)
  }

  /**
   * Obra ya registrada: por id de catálogo si se conoce, si no por tipo +
   * título (sin distinguir mayúsculas).
   */
  function findByTitle(type: MediaType, title: string, externalId?: string | null): MediaEntry | undefined {
    if (externalId) {
      const byId = entries.value.find((e) => e.type === type && e.externalId === externalId)
      if (byId) return byId
    }
    const t = title.trim().toLowerCase()
    return entries.value.find((e) => e.type === type && e.title.trim().toLowerCase() === t)
  }

  return {
    entries,
    loading,
    error,
    loaded,
    isEmpty,
    countByType,
    ensureLoaded,
    fetchAll,
    addEntry,
    editEntry,
    reloadEntry,
    deleteEntry,
    toggleFavorite,
    getById,
    findByTitle,
  }
})
