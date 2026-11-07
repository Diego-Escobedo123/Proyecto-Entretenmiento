<script setup lang="ts">
/**
 * WorkStats — la obra en números dentro de Mosaic (como la ficha de
 * Letterboxd): cuánta gente la tiene y en qué estado, la distribución de
 * estrellas de ½ a 5 con su promedio, y cuántas veces se terminó según los
 * diarios. Incluye al usuario actual (a diferencia de "Lo que opinan otros").
 * Arriba, quiénes de los que sigues la tienen (sólo perfiles públicos).
 *
 * Uso:
 *   <WorkStats :work="{ type, externalId, title }" />
 */
import { computed, ref, watch } from 'vue'
import BaseIcon from './BaseIcon.vue'
import RatingStars from './RatingStars.vue'
import RatingHistogram from './RatingHistogram.vue'
import UserAvatar from './social/UserAvatar.vue'
import { statusLabel } from '../lib/catalog'
import { socialService } from '../services/socialService'
import type { WorkKey, WorkStats } from '../types/review'

const props = defineProps<{ work: WorkKey }>()
defineEmits<{ navigate: [] }>()

const stats = ref<WorkStats | null>(null)
let requestId = 0

watch(
  () => [props.work.type, props.work.externalId, props.work.title],
  async () => {
    const current = ++requestId
    stats.value = null
    if (!props.work.externalId && !props.work.title.trim()) return
    try {
      const res = await socialService.statsFor(props.work)
      if (current === requestId) stats.value = res
    } catch {
      // Sin números: la ficha sigue igual, sólo no se muestra esta sección.
    }
  },
  { immediate: true },
)

/** Estados con al menos una persona, con su nombre propio del tipo ("Vista", "Leyendo"…). */
const statusChips = computed(() => {
  const s = stats.value
  if (!s) return []
  const t = props.work.type
  return [
    { n: s.byStatus.finished, label: statusLabel(t, 'completed') },
    { n: s.byStatus.inProgress, label: statusLabel(t, 'in-progress') },
    { n: s.byStatus.want, label: statusLabel(t, 'want') },
    { n: s.byStatus.abandoned, label: statusLabel(t, 'abandoned') },
  ].filter((c) => c.n > 0)
})

</script>

<template>
  <section v-if="stats" class="work-stats">
    <h4 class="work-stats__title"><BaseIcon name="bar-chart" /> En Mosaic</h4>

    <p v-if="!stats.people" class="work-stats__hint">Nadie en Mosaic la ha registrado todavía.</p>

    <template v-else>
      <div v-if="stats.following.length" class="work-stats__friends">
        <span class="work-stats__friends-title">De quienes sigues</span>
        <ul class="work-stats__friends-list">
          <li v-for="f in stats.following.slice(0, 6)" :key="f.user.id" class="work-stats__friend">
            <UserAvatar :user="f.user" :size="28" @navigate="$emit('navigate')" />
            <span class="work-stats__friend-name">{{ f.user.name.split(' ')[0] }}</span>
            <RatingStars v-if="f.rating != null" :value="f.rating" class="work-stats__friend-stars" />
            <span v-else class="work-stats__friend-status">{{ statusLabel(work.type, f.status) }}</span>
          </li>
        </ul>
        <span v-if="stats.following.length > 6" class="work-stats__friends-more">
          y {{ stats.following.length - 6 }} más
        </span>
      </div>

      <p class="work-stats__people">
        <strong>{{ stats.people }}</strong> {{ stats.people === 1 ? 'persona la tiene' : 'personas la tienen' }}
        <template v-if="stats.repeats">
          · {{ stats.repeats }} {{ stats.repeats === 1 ? 'volvió' : 'volvieron' }} a ella
        </template>
      </p>
      <ul class="work-stats__chips">
        <li v-for="c in statusChips" :key="c.label" class="work-stats__chip">
          <strong>{{ c.n }}</strong> {{ c.label }}
        </li>
      </ul>

      <RatingHistogram
        v-if="stats.rating.count"
        class="work-stats__rating"
        :histogram="stats.rating.histogram"
        :average="stats.rating.average"
        :count="stats.rating.count"
      />
    </template>
  </section>
</template>

<style scoped>
.work-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.work-stats__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text);
}

.work-stats__hint,
.work-stats__people {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.work-stats__people strong {
  color: var(--color-text);
}

.work-stats__friends {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.work-stats__friends-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.work-stats__friends-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm) var(--space-md);
}

.work-stats__friend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
}

.work-stats__friend-name {
  font-weight: 600;
  color: var(--color-text);
}

.work-stats__friend-stars {
  font-size: 0.75rem;
}

.work-stats__friend-status,
.work-stats__friends-more {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.work-stats__chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.work-stats__chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--color-surface-2);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.work-stats__chip strong {
  color: var(--color-text);
}

.work-stats__rating {
  margin-top: var(--space-xs);
}
</style>
