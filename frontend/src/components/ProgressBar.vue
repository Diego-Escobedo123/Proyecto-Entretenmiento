<script setup lang="ts">
/**
 * ProgressBar — barra de progreso lineal (ej. "64% Completed").
 * Se llena desde 0 cuando llega a verse en pantalla. Con `complete`, al
 * terminar de llenarse pasa un brillo dorado (meta cumplida).
 * Uso: <ProgressBar :percent="64" />
 */
import { computed, ref } from 'vue'
import { useInView } from '../composables/useInView'

const props = defineProps<{
  percent: number // 0-100
  complete?: boolean
}>()

const clamped = computed(() => Math.min(100, Math.max(0, props.percent)))

/** Empieza en 0 y pasa al valor real al entrar en pantalla: así la transición se ve. */
const el = ref<HTMLElement | null>(null)
const shown = useInView(el, 0.5)
</script>

<template>
  <div
    ref="el"
    class="progress-bar"
    :class="{ 'is-complete': complete && shown }"
    role="progressbar"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="progress-bar__fill" :style="{ width: (shown ? clamped : 0) + '%' }" />
  </div>
</template>

<style scoped>
.progress-bar {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--color-surface-2);
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 999px;
  transition: width var(--dur-slow) var(--ease-out);
}

/* Meta cumplida: un destello recorre la barra una vez, cuando ya terminó de llenarse. */
.progress-bar.is-complete::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.6) 50%, transparent 70%);
  transform: translateX(-100%);
  animation: progress-bar-shine 900ms ease-in-out var(--dur-slow) both;
}

@keyframes progress-bar-shine {
  to {
    transform: translateX(100%);
  }
}
</style>
