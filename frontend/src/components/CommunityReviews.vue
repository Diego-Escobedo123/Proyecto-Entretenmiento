<script setup lang="ts">
/**
 * CommunityReviews — cómo calificaron y comentaron una obra los DEMÁS
 * usuarios (promedio + comentarios públicos). Nunca muestra notas: ésas sólo
 * aparecen en el perfil de cada usuario.
 *
 * Uso:
 *   <CommunityReviews :work="{ type, externalId, title }" @navigate="cerrarModal" />
 * `navigate` se emite al abrir el perfil de quien reseñó, para que el modal
 * contenedor se cierre.
 */
import { computed, ref, watch } from 'vue'
import BaseIcon from './BaseIcon.vue'
import BaseSpinner from './BaseSpinner.vue'
import RatingStars from './RatingStars.vue'
import { socialService } from '../services/socialService'
import type { WorkKey, WorkReviews } from '../types/review'

const props = defineProps<{ work: WorkKey }>()
defineEmits<{ navigate: [] }>()

const INITIAL_VISIBLE = 3

const data = ref<WorkReviews | null>(null)
const loading = ref(false)
const failed = ref(false)
const expanded = ref(false)
let requestId = 0

async function load() {
  if (!props.work.title.trim() && !props.work.externalId) return
  const current = ++requestId
  loading.value = true
  failed.value = false
  expanded.value = false
  try {
    const res = await socialService.reviewsFor(props.work)
    if (current === requestId) data.value = res
  } catch {
    if (current === requestId) failed.value = true
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(
  () => [props.work.type, props.work.externalId, props.work.title],
  load,
  { immediate: true },
)

const visibleReviews = computed(() => {
  const all = data.value?.reviews ?? []
  return expanded.value ? all : all.slice(0, INITIAL_VISIBLE)
})
const hiddenCount = computed(() => (data.value?.reviews.length ?? 0) - visibleReviews.value.length)
const isEmpty = computed(() => data.value != null && data.value.ratingCount === 0 && !data.value.reviews.length)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <section class="community">
    <header class="community__head">
      <h4 class="community__title"><BaseIcon name="people" /> Lo que opinan otros</h4>
      <span v-if="data && data.average != null" class="community__average">
        <BaseIcon name="star-fill" /> {{ data.average.toFixed(1) }}
        <span class="community__count">
          · {{ data.ratingCount }} {{ data.ratingCount === 1 ? 'calificación' : 'calificaciones' }}
        </span>
      </span>
    </header>

    <p v-if="loading" class="community__hint"><BaseSpinner size="sm" /> Cargando reseñas…</p>
    <p v-else-if="failed" class="community__hint">No se pudieron cargar las reseñas.</p>
    <p v-else-if="isEmpty" class="community__hint">
      Nadie más ha reseñado esta obra todavía. ¡Sé la primera persona!
    </p>
    <p v-else-if="data && !data.reviews.length" class="community__hint">
      Otros la calificaron, pero nadie ha dejado un comentario aún.
    </p>

    <ul v-if="!loading && visibleReviews.length" class="community__list">
      <li v-for="r in visibleReviews" :key="r.id" class="community__review">
        <RouterLink :to="`/users/${r.user.id}`" class="community__avatar" @click="$emit('navigate')">
          <img v-if="r.user.avatar" :src="r.user.avatar" alt="" />
          <span v-else>{{ r.user.name.charAt(0).toUpperCase() }}</span>
        </RouterLink>
        <div class="community__body">
          <div class="community__meta">
            <RouterLink :to="`/users/${r.user.id}`" class="community__author" @click="$emit('navigate')">
              {{ r.user.name }}
            </RouterLink>
            <RatingStars v-if="r.rating != null" :value="r.rating" class="community__stars" />
            <span class="community__date">{{ formatDate(r.updatedAt) }}</span>
          </div>
          <p class="community__text">{{ r.review }}</p>
        </div>
      </li>
    </ul>

    <button v-if="!loading && hiddenCount > 0" type="button" class="community__more" @click="expanded = true">
      Ver {{ hiddenCount }} {{ hiddenCount === 1 ? 'comentario más' : 'comentarios más' }}
    </button>
  </section>
</template>

<style scoped>
.community {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.community__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.community__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text);
}

.community__average {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-warning);
}

.community__count {
  font-weight: 500;
  color: var(--color-text-muted);
}

.community__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.community__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.community__review {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.community__avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 700;
  font-size: 0.875rem;
  text-decoration: none;
}

.community__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.community__body {
  flex: 1;
  min-width: 0;
}

.community__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px var(--space-sm);
}

.community__author {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
}

.community__author:hover {
  color: var(--color-accent);
  text-decoration: underline;
}

.community__stars {
  font-size: 0.75rem;
}

.community__date {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.community__text {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: var(--color-text);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.community__more {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  color: var(--color-accent);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.community__more:hover {
  text-decoration: underline;
}
</style>
