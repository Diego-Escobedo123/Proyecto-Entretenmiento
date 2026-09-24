/**
 * Estado de interfaz transversal: búsqueda global y qué modal está abierto.
 * No se persiste — es efímero por sesión.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { MediaEntryInput } from '../types/media'

/** Datos con los que precargar el alta de una obra (p. ej. desde el buscador global). */
export type EntryPrefill = Partial<
  Pick<MediaEntryInput, 'type' | 'title' | 'creator' | 'year' | 'genres' | 'cover' | 'externalId'>
>

/** Obra de un catálogo externo, tal como se muestra en su ficha. */
export type CatalogWork = Pick<
  MediaEntryInput,
  'type' | 'title' | 'creator' | 'year' | 'genres' | 'cover' | 'externalId'
>

type ModalState =
  | { name: 'none' }
  | { name: 'entry-form'; entryId: string | null; prefill?: EntryPrefill }
  | { name: 'work-detail'; work: CatalogWork }
  | { name: 'settings' }

export const useUiStore = defineStore('ui', () => {
  const searchQuery = ref('')
  const modal = ref<ModalState>({ name: 'none' })
  /** Drawer de navegación en viewport angosto. Ignorado en escritorio. */
  const mobileNavOpen = ref(false)

  const isEntryFormOpen = computed(() => modal.value.name === 'entry-form')
  const isSettingsOpen = computed(() => modal.value.name === 'settings')
  const editingEntryId = computed(() =>
    modal.value.name === 'entry-form' ? modal.value.entryId : null,
  )
  const entryPrefill = computed(() =>
    modal.value.name === 'entry-form' ? modal.value.prefill ?? null : null,
  )
  const detailWork = computed(() =>
    modal.value.name === 'work-detail' ? modal.value.work : null,
  )

  /** Ficha de una obra del catálogo: datos + reseñas de la comunidad. */
  function openWorkDetail(work: CatalogWork): void {
    modal.value = { name: 'work-detail', work }
  }

  function openCreateEntry(prefill?: EntryPrefill): void {
    modal.value = { name: 'entry-form', entryId: null, prefill }
  }

  function openEditEntry(entryId: string): void {
    modal.value = { name: 'entry-form', entryId }
  }

  function openSettings(): void {
    modal.value = { name: 'settings' }
  }

  function closeModal(): void {
    modal.value = { name: 'none' }
  }

  function setSearch(value: string): void {
    searchQuery.value = value
  }

  function toggleMobileNav(force?: boolean): void {
    mobileNavOpen.value = force ?? !mobileNavOpen.value
  }

  return {
    searchQuery,
    mobileNavOpen,
    isEntryFormOpen,
    isSettingsOpen,
    editingEntryId,
    entryPrefill,
    detailWork,
    openWorkDetail,
    openCreateEntry,
    openEditEntry,
    openSettings,
    closeModal,
    setSearch,
    toggleMobileNav,
  }
})
