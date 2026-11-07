<script setup lang="ts">
/**
 * CountUp — número que sube desde 0 cuando llega a verse en pantalla (y del
 * valor anterior al nuevo cuando cambia). Con "reducir movimiento" muestra el
 * valor directo.
 * Uso: <CountUp :value="profile.counts.works" />
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { useInView } from '../composables/useInView'

const props = withDefaults(defineProps<{ value: number; duration?: number }>(), { duration: 700 })

const el = ref<HTMLElement | null>(null)
const inView = useInView(el, 0.5)

const display = ref(0)
let frame = 0

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

watch(
  [() => props.value, inView],
  ([to, visible]) => {
    if (!visible) return
    cancelAnimationFrame(frame)
    const from = display.value
    if (from === to || reduceMotion()) {
      display.value = to
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / props.duration)
      const eased = 1 - (1 - t) ** 3 // rápido al principio, frena al llegar
      display.value = Math.round(from + (to - from) * eased)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  },
  { immediate: true },
)

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <span ref="el" class="count-up">{{ display.toLocaleString('es') }}</span>
</template>

<style scoped>
/* Cifras del mismo ancho: el número no "baila" mientras sube. */
.count-up {
  font-variant-numeric: tabular-nums;
}
</style>
