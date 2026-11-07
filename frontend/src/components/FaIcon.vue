<script setup lang="ts">
/**
 * FaIcon — un ícono de Font Awesome Free como SVG en línea, para los que
 * Bootstrap Icons no tiene (la fuente principal sigue siendo BaseIcon).
 * Se importa cada ícono por separado, así al build sólo entra lo que se usa.
 * Hereda color y tamaño del texto, igual que BaseIcon.
 *
 * Uso:
 *   import { faDna } from '@fortawesome/free-solid-svg-icons'
 *   <FaIcon :icon="faDna" />
 *
 * Íconos de Font Awesome Free: licencia CC BY 4.0 (créditos en el README).
 */
import { computed } from 'vue'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'

const props = defineProps<{ icon: IconDefinition }>()

const viewBox = computed(() => `0 0 ${props.icon.icon[0]} ${props.icon.icon[1]}`)
/** Los íconos duotono traen dos trazos; los sólidos, uno. */
const paths = computed(() => {
  const d = props.icon.icon[4]
  return Array.isArray(d) ? d : [d]
})
</script>

<template>
  <svg class="fa-icon" :viewBox="viewBox" aria-hidden="true" focusable="false">
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
/* Mismo tamaño y alineación que los íconos de Bootstrap (1em, un poco bajo la línea). */
.fa-icon {
  display: inline-block;
  height: 1em;
  width: auto;
  vertical-align: -0.125em;
  fill: currentColor;
  flex-shrink: 0;
}
</style>
