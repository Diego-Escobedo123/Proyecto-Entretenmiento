/**
 * Estado de interfaz transversal: búsqueda global y qué modal está abierto.
 * No se persiste — es efímero por sesión.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

type ModalState =
  | { name: 'none' }
  | { name: 'entry-form'; entryId: string | null }
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

  function openCreateEntry(): void {
    modal.value = { name: 'entry-form', entryId: null }
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
    openCreateEntry,
    openEditEntry,
    openSettings,
    closeModal,
    setSearch,
    toggleMobileNav,
  }
})
