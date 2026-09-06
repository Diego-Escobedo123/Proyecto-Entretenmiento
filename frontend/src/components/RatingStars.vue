<script setup lang="ts">
/**
 * RatingStars — rating de 0 a `max` en estrellas.
 * Modo lectura:   <RatingStars :value="4" />
 * Modo edición:   <RatingStars :value="form.rating ?? 0" editable @update:value="form.rating = $event" />
 *                 (click en una estrella activa; click en la misma la limpia a 0)
 */
import { computed } from 'vue'
import BaseIcon from './BaseIcon.vue'

const props = withDefaults(
  defineProps<{ value: number; max?: number; editable?: boolean }>(),
  { max: 5, editable: false },
)

const emit = defineEmits<{ 'update:value': [number] }>()

const stars = computed(() =>
  Array.from({ length: props.max }, (_, i) => i < Math.round(props.value)),
)

function pick(index: number) {
  if (!props.editable) return
  const next = index + 1
  emit('update:value', props.value === next ? 0 : next)
}
</script>

<template>
  <span
    class="rating-stars"
    :class="{ 'rating-stars--editable': editable }"
    :aria-label="`${value} de ${max}`"
    :role="editable ? 'slider' : undefined"
    :aria-valuenow="editable ? value : undefined"
    :aria-valuemin="editable ? 0 : undefined"
    :aria-valuemax="editable ? max : undefined"
  >
    <component
      :is="editable ? 'button' : 'span'"
      v-for="(filled, i) in stars"
      :key="i"
      :type="editable ? 'button' : undefined"
      class="rating-stars__star"
      :class="{ 'rating-stars__star--filled': filled }"
      :aria-label="editable ? `${i + 1} estrella(s)` : undefined"
      @click="pick(i)"
    ><BaseIcon :name="filled ? 'star-fill' : 'star'" /></component>
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
  background: none;
  border: none;
  padding: 0;
}

.rating-stars--editable .rating-stars__star {
  cursor: pointer;
  font-size: 1.375rem;
}

.rating-stars__star--filled {
  color: var(--color-warning);
}
</style>
