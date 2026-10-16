/**
 * Store de obras: única fuente de verdad para la colección en toda la app.
 * Las screens leen `entries` / getters y llaman a las acciones; nunca tocan
 * el servicio ni localStorage directamente.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { mediaService, type MediaWriteOptions } from '../services/mediaService'
import type { MediaEntry, MediaEntryInput, MediaType } from '../types/media'
import { useToastStore } from './toast'

/** Datos de catálogo de una obra (lo mismo que `CatalogWork` del store de UI). */
type CatalogWorkInput = Pick<MediaEntryInput, 'type' | 'title' | 'creator' | 'year' | 'genres' | 'cover' | 'externalId'>

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

  // --- Eliminar con "Deshacer" ---
  // La obra sale de la pantalla al instante, pero el borrado real espera a que
  // el aviso se cierre: "Deshacer" la devuelve a su lugar sin tocar el backend
  // (y sin perder su diario, que se borraría en cascada).

  const UNDO_MS = 5000
  const pendingDeletes = new Map<string, { entry: MediaEntry; index: number; timer: ReturnType<typeof setTimeout> }>()

  function restore(id: string) {
    const pending = pendingDeletes.get(id)
    if (!pending) return
    clearTimeout(pending.timer)
    pendingDeletes.delete(id)
    const list = [...entries.value]
    list.splice(Math.min(pending.index, list.length), 0, pending.entry)
    entries.value = list
  }

  async function commitDelete(id: string) {
    const pending = pendingDeletes.get(id)
    if (!pending) return
    try {
      await mediaService.remove(id)
      pendingDeletes.delete(id)
    } catch {
      restore(id)
      useToastStore().error(`No se pudo eliminar «${pending.entry.title}».`)
    }
  }

  /** Quita la obra con un aviso que permite deshacerlo. `message`: el texto del aviso. */
  function deleteEntryWithUndo(id: string, message?: string): void {
    const index = entries.value.findIndex((e) => e.id === id)
    if (index < 0) return
    const entry = entries.value[index]
    entries.value = entries.value.filter((e) => e.id !== id)
    pendingDeletes.set(id, { entry, index, timer: setTimeout(() => void commitDelete(id), UNDO_MS) })
    useToastStore().show(message ?? `Se eliminó «${entry.title}» de tu colección.`, {
      action: { label: 'Deshacer', run: () => restore(id) },
      duration: UNDO_MS,
    })
  }

  // Si cierra la pestaña con un borrado pendiente, se manda igual (ya no hay cómo deshacerlo).
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      for (const [id, pending] of pendingDeletes) {
        clearTimeout(pending.timer)
        void mediaService.remove(id).catch(() => {})
      }
      pendingDeletes.clear()
    })
  }

  /**
   * Favorita al instante (el corazón no espera al servidor); si falla, vuelve
   * a como estaba y avisa.
   */
  async function toggleFavorite(id: string): Promise<void> {
    const entry = entries.value.find((e) => e.id === id)
    if (!entry) return
    const next = !entry.favorite
    const setFavorite = (value: boolean) =>
      (entries.value = entries.value.map((e) => (e.id === id ? { ...e, favorite: value } : e)))
    setFavorite(next)
    try {
      const updated = await mediaService.update(id, { favorite: next })
      entries.value = entries.value.map((e) => (e.id === id ? updated : e))
    } catch {
      setFavorite(!next)
      useToastStore().error('No se pudo actualizar tus favoritas. Inténtalo de nuevo.')
    }
  }

  /**
   * Wishlist: obras de la colección en estado "Quiero verla/leerlo/…"
   * (`want`), las agregadas más recientemente primero.
   */
  const wishlist = computed(() =>
    entries.value.filter((e) => e.status === 'want').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )

  /** Agrega una obra del catálogo directo a la wishlist (sin pasar por el formulario). */
  async function addToWishlist(work: CatalogWorkInput): Promise<MediaEntry> {
    return addEntry({
      ...work,
      status: 'want',
      rating: null,
      progress: null,
      pagesRead: null,
      pagesTotal: null,
      season: null,
      episode: null,
      hoursPlayed: null,
      platform: null,
      favorite: false,
      review: '',
      notes: '',
      notesPublic: false,
    })
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
    deleteEntryWithUndo,
    toggleFavorite,
    wishlist,
    addToWishlist,
    getById,
    findByTitle,
  }
})
