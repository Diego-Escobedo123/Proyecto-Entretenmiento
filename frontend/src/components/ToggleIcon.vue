<script setup lang="ts">
/**
 * ToggleIcon — ícono de dos estados (corazón, marcador…) que hace "pop" al
 * activarse y, con `burst`, suelta un estallido de semillas de higo (como las
 * de Inicio). Sólo anima al pasar de apagado a encendido, nunca al montarse:
 * una tarjeta que ya era favorita no salta al aparecer.
 *
 * Uso (dentro del botón que lo activa):
 *   <ToggleIcon :on="entry.favorite" icon="heart" icon-on="heart-fill" burst />
 */
import { ref, watch } from 'vue'
import BaseIcon from './BaseIcon.vue'

const props = defineProps<{ on: boolean; icon: string; iconOn: string; burst?: boolean }>()

/** Cambia en cada activación: re-monta el glifo y las semillas para reiniciar la animación. */
const playKey = ref(0)

watch(
  () => props.on,
  (on, was) => {
    if (on && !was) playKey.value++
  },
)

/** Semillas del estallido: dirección y color (dorado el doble, como en FloatingSeeds). */
const SEEDS = [0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => ({
  angle: `${angle}deg`,
  color: ['#D3BF46', '#D8ADAA', '#D3BF46', '#9D2D27'][i % 4],
}))
</script>

<template>
  <span class="toggle-icon">
    <span :key="playKey" class="toggle-icon__glyph" :class="{ 'is-popping': playKey > 0 }">
      <BaseIcon :name="on ? iconOn : icon" />
    </span>
    <span v-if="burst && playKey > 0" :key="`burst-${playKey}`" class="toggle-icon__burst" aria-hidden="true">
      <span
        v-for="seed in SEEDS"
        :key="seed.angle"
        class="toggle-icon__seed"
        :style="{ '--angle': seed.angle, background: seed.color }"
      />
    </span>
  </span>
</template>

<style scoped>
.toggle-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toggle-icon__glyph {
  display: inline-flex;
}

.toggle-icon__glyph.is-popping {
  animation: mosaic-pop var(--dur-base) var(--ease-spring);
}

.toggle-icon__burst {
  position: absolute;
  inset: 50% auto auto 50%;
  pointer-events: none;
}

/* Cada semilla sale del centro hacia su ángulo y se desvanece. */
.toggle-icon__seed {
  position: absolute;
  top: -3px;
  left: -2px;
  width: 4px;
  height: 6px;
  border-radius: 50%;
  opacity: 0;
  animation: toggle-icon-seed var(--dur-slow) var(--ease-out) forwards;
}

@keyframes toggle-icon-seed {
  0% {
    opacity: 1;
    transform: rotate(var(--angle)) translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: rotate(var(--angle)) translateY(-16px) scale(0.5);
  }
}
</style>
