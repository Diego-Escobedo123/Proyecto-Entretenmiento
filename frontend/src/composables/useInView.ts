/**
 * useInView — se vuelve `true` la primera vez que el elemento entra en
 * pantalla (y se queda así). Sirve para que una animación de entrada
 * (contadores, la dona del ADN, las barras del año…) empiece cuando la
 * persona llega a verla al hacer scroll, no al cargar la página.
 *
 * Uso:
 *   const el = ref<HTMLElement | null>(null)
 *   const inView = useInView(el)
 *   <div ref="el" :class="{ 'is-revealed': inView }">…</div>
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export function useInView(target: Ref<Element | null>, threshold = 0.25): Ref<boolean> {
  const inView = ref(false)
  let observer: IntersectionObserver | undefined

  onMounted(() => {
    const el = target.value
    // Sin soporte (o sin elemento): se muestra directo, nunca queda escondido.
    if (!el || typeof IntersectionObserver === 'undefined') {
      inView.value = true
      return
    }
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        inView.value = true
        observer?.disconnect()
      },
      { threshold },
    )
    observer.observe(el)
  })

  onBeforeUnmount(() => observer?.disconnect())

  return inView
}
