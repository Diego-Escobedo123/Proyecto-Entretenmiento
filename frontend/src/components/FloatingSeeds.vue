<script setup lang="ts">
import { computed } from 'vue'

/**
 * Semillas de higo que flotan lentamente hacia arriba.
 * Va UNA sola vez en el layout, detrás del contenido.
 * Solo usa transform y opacity, que son las propiedades más baratas de animar.
 */
const props = withDefaults(
  defineProps<{
    count?: number      // cuántas semillas (30–45 se ve bien)
    seed?: number       // cambia el patrón; el mismo número da siempre el mismo patrón
    intensity?: number  // opacidad máxima de cada semilla (0–1)
  }>(),
  { count: 40, seed: 9, intensity: 0.5 },
)

const COLORS = ['#D3BF46', '#D3BF46', '#9D2D27', '#D8ADAA'] // dorado aparece el doble
const SIZES = [5, 6, 7, 8, 9]

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const seeds = computed(() => {
  const rand = mulberry32(props.seed)
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]
  return Array.from({ length: props.count }, () => {
    const size = pick(SIZES)
    const duration = 16 + rand() * 10        // 16–26 s por recorrido
    return {
      left: `${(rand() * 100).toFixed(2)}%`,
      width: `${size}px`,
      height: `${Math.round(size * 1.5)}px`,
      background: pick(COLORS),
      animationDuration: `${duration.toFixed(1)}s`,
      animationDelay: `-${(rand() * duration).toFixed(1)}s`, // arrancan repartidas, no todas abajo
      '--drift': `${Math.round((rand() - 0.5) * 80)}px`,     // se desvían un poco a los lados
      '--spin': `${Math.round(120 + rand() * 200)}deg`,
    }
  })
})
</script>

<template>
  <div class="seeds" aria-hidden="true" :style="{ '--max-opacity': intensity }">
    <div class="seeds__glow" />
    <span v-for="(s, i) in seeds" :key="i" class="seeds__seed" :style="s" />
  </div>
</template>

<style scoped>
.seeds {
  position: fixed;
  inset: 0;
  z-index: 0;              /* el contenido debe ir con z-index 1 o mayor */
  overflow: hidden;
  pointer-events: none;    /* no bloquea clics */
}

/* Brillo cálido desde abajo */
.seeds__glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 60% 130%, rgba(216, 173, 170, 0.22), transparent 55%);
}

.seeds__seed {
  position: absolute;
  bottom: -20px;
  border-radius: 50%;
  opacity: 0;
  will-change: transform, opacity;
  animation-name: float;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes float {
  0%   { transform: translate(0, 0) rotate(0); opacity: 0; }
  12%  { opacity: var(--max-opacity); }
  85%  { opacity: calc(var(--max-opacity) * 0.7); }
  100% { transform: translate(var(--drift), -110vh) rotate(var(--spin)); opacity: 0; }
}

/* Respeta "reducir movimiento": quita las semillas y deja solo el brillo */
@media (prefers-reduced-motion: reduce) {
  .seeds__seed { display: none; }
}
</style>
