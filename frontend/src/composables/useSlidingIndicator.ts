/**
 * useSlidingIndicator — una "pastilla" que se desliza detrás de la opción
 * activa de un grupo (sidebar, filtros de Explorar…), en vez de que el
 * resaltado salte de una a otra.
 *
 * Mide la opción activa (`activeSelector`, dentro de `container`) cada vez
 * que cambia `trigger` o el tamaño del contenedor. El contenedor debe tener
 * `position: relative` y el indicador `position: absolute; top: 0; left: 0`.
 * `ready` se activa después de la primera medición: así, al cargar la página,
 * la pastilla aparece en su lugar en vez de deslizarse desde la esquina.
 *
 * Uso:
 *   const nav = ref<HTMLElement | null>(null)
 *   const { style, ready } = useSlidingIndicator(nav, '.is-active', () => route.path)
 *   <span class="indicator" :class="{ 'is-ready': ready }" :style="style" />
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref, type WatchSource } from 'vue'

interface Box {
  left: number
  top: number
  width: number
  height: number
}

export function useSlidingIndicator(container: Ref<HTMLElement | null>, activeSelector: string, trigger: WatchSource) {
  const box = ref<Box | null>(null)
  const ready = ref(false)

  function measure() {
    const active = container.value?.querySelector<HTMLElement>(activeSelector)
    box.value = active
      ? { left: active.offsetLeft, top: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight }
      : null
  }

  // Después de que la opción nueva ya tiene su clase de activa en el DOM.
  watch(trigger, () => void nextTick(measure), { flush: 'post' })

  let resizeObserver: ResizeObserver | undefined
  onMounted(() => {
    measure()
    requestAnimationFrame(() => (ready.value = true))
    if (container.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measure)
      resizeObserver.observe(container.value)
    }
  })
  onBeforeUnmount(() => resizeObserver?.disconnect())

  /** Sin opción activa (p. ej. una ruta que no está en el menú), la pastilla se esconde. */
  const style = computed(() =>
    box.value
      ? {
          width: `${box.value.width}px`,
          height: `${box.value.height}px`,
          transform: `translate(${box.value.left}px, ${box.value.top}px)`,
          opacity: 1,
        }
      : { opacity: 0 },
  )

  return { style, ready, measure }
}
