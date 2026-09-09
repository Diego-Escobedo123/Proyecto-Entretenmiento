/**
 * useDebouncedSearch — retrasa la reacción a un texto de búsqueda y expone
 * un flag `isSearching` mientras tanto, para poder mostrar un loading.
 *
 * Hoy el filtrado es sobre arreglos hardcodeados, así que el delay es
 * artificial (a propósito, para que la UI se sienta como si buscara contra
 * un servidor). TODO(backend): cuando el filtrado dispare un fetch real,
 * `isSearching` puede reflejar el estado de esa petición en vez de un timer.
 */
import { onUnmounted, ref, watch, type Ref } from 'vue'

export function useDebouncedSearch(source: Ref<string>, delayMs = 400) {
  const debouncedQuery = ref(source.value)
  const isSearching = ref(false)
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  watch(source, (value) => {
    isSearching.value = true
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      debouncedQuery.value = value
      isSearching.value = false
    }, delayMs)
  })

  onUnmounted(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })

  return { debouncedQuery, isSearching }
}