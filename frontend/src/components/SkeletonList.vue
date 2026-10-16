<script setup lang="ts">
/**
 * SkeletonList — siluetas de filas (personas, solicitudes, historial…)
 * mientras cargan, con el brillo de .mosaic-skeleton. Con `avatar`, cada fila
 * lleva un círculo a la izquierda, como PersonRow.
 * Uso: <SkeletonList v-if="loading" :rows="4" avatar />
 */
withDefaults(defineProps<{ rows?: number; avatar?: boolean }>(), { rows: 3, avatar: false })
</script>

<template>
  <ul class="skeleton-list" aria-busy="true" aria-label="Cargando">
    <li v-for="n in rows" :key="n" class="skeleton-list__row">
      <span v-if="avatar" class="skeleton-list__avatar mosaic-skeleton" />
      <span class="skeleton-list__text">
        <!-- Anchos distintos por fila: que no parezca una tabla de rayas iguales. -->
        <span class="skeleton-list__line mosaic-skeleton" :style="{ width: `${[55, 40, 65, 45][n % 4]}%` }" />
        <span class="skeleton-list__line skeleton-list__line--thin mosaic-skeleton" :style="{ width: `${[30, 50, 35, 25][n % 4]}%` }" />
      </span>
    </li>
  </ul>
</template>

<style scoped>
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.skeleton-list__row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.skeleton-list__avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.skeleton-list__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.skeleton-list__line {
  height: 12px;
  border-radius: 999px;
}

.skeleton-list__line--thin {
  height: 10px;
}
</style>
