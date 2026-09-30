<script setup lang="ts">
/**
 * Seguidores / Seguidos de una persona (/users/:id/followers y
 * /users/:id/following; `me` = el usuario actual). Pestañas para cambiar
 * entre ambas listas.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseIcon from '../components/BaseIcon.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import PersonRow from '../components/social/PersonRow.vue'
import { socialService } from '../services/socialService'
import type { PublicProfile } from '../types/review'
import type { Person } from '../types/social'

const route = useRoute()
const userId = computed(() => String(route.params.id ?? ''))
const tab = computed<'followers' | 'following'>(() => (route.params.tab === 'following' ? 'following' : 'followers'))

const profile = ref<PublicProfile | null>(null)
const people = ref<Person[]>([])
const loading = ref(true)
const failed = ref(false)

watch(
  [userId, tab],
  async ([id, t], [prevId]) => {
    loading.value = true
    failed.value = false
    try {
      const [p, list] = await Promise.all([
        id !== prevId || !profile.value ? socialService.publicProfile(id) : Promise.resolve(profile.value),
        t === 'followers' ? socialService.followers(id) : socialService.following(id),
      ])
      profile.value = p
      people.value = list
    } catch {
      failed.value = true
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const EMPTY = {
  followers: { self: 'Todavía nadie te sigue.', other: 'Todavía nadie sigue a esta persona.' },
  following: { self: 'Todavía no sigues a nadie.', other: 'Esta persona todavía no sigue a nadie.' },
}
</script>

<template>
  <div class="follows">
    <RouterLink v-if="profile" :to="`/users/${profile.user.id}`" class="follows__back">
      <BaseIcon name="arrow-left" /> {{ profile.isSelf ? 'Tu perfil público' : profile.user.name }}
    </RouterLink>

    <nav class="follows__tabs" aria-label="Seguidores y seguidos">
      <RouterLink :to="`/users/${userId}/followers`" class="follows__tab" :class="{ 'is-active': tab === 'followers' }">
        Seguidores<template v-if="profile"> · {{ profile.followers }}</template>
      </RouterLink>
      <RouterLink :to="`/users/${userId}/following`" class="follows__tab" :class="{ 'is-active': tab === 'following' }">
        Seguidos<template v-if="profile"> · {{ profile.following }}</template>
      </RouterLink>
    </nav>

    <p v-if="loading" class="follows__hint"><BaseSpinner size="sm" /> Cargando…</p>
    <EmptyState v-else-if="failed" icon="person-x" title="No se pudo cargar la lista." />
    <EmptyState
      v-else-if="!people.length"
      compact
      icon="people"
      :title="profile?.isSelf ? EMPTY[tab].self : EMPTY[tab].other"
    >
      <RouterLink v-if="profile?.isSelf" to="/people" class="follows__cta">Buscar personas</RouterLink>
    </EmptyState>
    <div v-else class="follows__list">
      <PersonRow v-for="p in people" :key="p.id" :person="p" />
    </div>
  </div>
</template>

<style scoped>
.follows {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 720px;
}

.follows__back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.follows__back:hover {
  color: var(--color-text);
}

.follows__tabs {
  display: flex;
  gap: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.follows__tab {
  margin-bottom: -1px;
  padding: var(--space-sm) 2px;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-weight: 600;
}

.follows__tab.is-active {
  color: var(--color-text);
  border-bottom-color: var(--color-accent);
}

.follows__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  color: var(--color-text-muted);
}

.follows__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.follows__cta {
  font-weight: 700;
  color: var(--color-accent);
}
</style>
