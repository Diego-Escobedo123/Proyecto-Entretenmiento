<script setup lang="ts">
/**
 * RatingStars — rating de 0 a `max` en estrellas, con medias estrellas.
 * Modo lectura:   <RatingStars :value="3.5" />
 * Modo edición:   <RatingStars :value="form.rating ?? 0" editable @update:value="form.rating = $event" />
 *                 Click en la mitad izquierda de una estrella = media estrella;
 *                 click en el mismo valor lo limpia a 0. Flechas: ±½.
 */
import { computed } from 'vue'
import BaseIcon from './BaseIcon.vue'

const props = withDefaults(
  defineProps<{ value: number; max?: number; editable?: boolean }>(),
  { max: 5, editable: false },
)

const emit = defineEmits<{ 'update:value': [number] }>()

/** Valor redondeado al medio punto más cercano. */
const rounded = computed(() => Math.round(props.value * 2) / 2)

const stars = computed(() =>
  Array.from({ length: props.max }, (_, i) => {
    const fill = rounded.value - i
    return fill >= 1 ? 'star-fill' : fill >= 0.5 ? 'star-half' : 'star'
  }),
)

const label = computed(() => `${rounded.value.toLocaleString('es')} de ${props.max}`)

function set(next: number) {
  emit('update:value', Math.min(props.max, Math.max(0, next)))
}

function pick(index: number, event: MouseEvent) {
  if (!props.editable) return
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const isLeftHalf = event.clientX - rect.left < rect.width / 2
  const next = index + (isLeftHalf ? 0.5 : 1)
  set(props.value === next ? 0 : next)
}

function onKey(event: KeyboardEvent) {
  if (!props.editable) return
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') set(rounded.value + 0.5)
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') set(rounded.value - 0.5)
  else if (event.key === 'Home' || event.key === 'Delete' || event.key === 'Backspace') set(0)
  else if (event.key === 'End') set(props.max)
  else return
  event.preventDefault()
}
</script>

<template>
  <span
    class="rating-stars"
    :class="{ 'rating-stars--editable': editable }"
    :aria-label="editable ? 'Calificación' : label"
    :role="editable ? 'slider' : 'img'"
    :tabindex="editable ? 0 : undefined"
    :aria-valuenow="editable ? rounded : undefined"
    :aria-valuetext="editable ? label : undefined"
    :aria-valuemin="editable ? 0 : undefined"
    :aria-valuemax="editable ? max : undefined"
    @keydown="onKey"
  >
    <span
      v-for="(icon, i) in stars"
      :key="i"
      class="rating-stars__star"
      :class="{ 'rating-stars__star--filled': icon !== 'star' }"
      aria-hidden="true"
      @click="pick(i, $event)"
    ><BaseIcon :name="icon" /></span>
  </span>
</template>

<style scoped>
.rating-stars {
  display: inline-flex;
  gap: 2px;
}

.rating-stars__star {
  color: var(--color-text-subtle);
  font-size: 1rem;
  line-height: 1;
}

.rating-stars--editable {
  border-radius: var(--radius-sm);
}

.rating-stars--editable:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.rating-stars--editable .rating-stars__star {
  cursor: pointer;
  font-size: 1.375rem;
}

.rating-stars__star--filled {
  color: var(--color-warning);
}
</style>
