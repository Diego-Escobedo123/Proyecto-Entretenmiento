<script setup lang="ts">
/**
 * SuggestedProfileRow — perfil sugerido a partir de gustos similares.
 * Hardcodeado por ahora: en el futuro vendrá de un endpoint de sugerencias.
 */
import BaseIcon from '../BaseIcon.vue'

defineProps<{
  name: string
  avatar: string
  interests: string
}>()

defineEmits<{ follow: [] }>()
</script>

<template>
  <div class="suggested-row">
    <div class="suggested-row__who">
      <img class="suggested-row__avatar" :src="avatar" :alt="name" />
      <div>
        <p class="suggested-row__name">{{ name }}</p>
        <p class="suggested-row__interests">{{ interests }}</p>
      </div>
    </div>

    <button class="suggested-row__follow" type="button" aria-label="Seguir" @click="$emit('follow')">
      <BaseIcon name="person-plus" />
    </button>
  </div>
</template>

<style scoped>
.suggested-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.suggested-row__who {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.suggested-row__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.suggested-row__name {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.suggested-row__interests {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  margin: 0;
}

.suggested-row__follow {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.suggested-row__follow:hover,
.suggested-row__follow:active {
  background: var(--color-accent-hover-bg);
  color: var(--color-accent-hover-contrast);
  border-color: var(--color-accent-hover);
}
</style>