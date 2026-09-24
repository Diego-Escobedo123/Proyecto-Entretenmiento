<script setup lang="ts">
/**
 * Perfil público — lo que los demás ven de un usuario: sus obras, las
 * reseñas (siempre públicas) y sólo las notas que marcó como públicas.
 * Ruta: /users/:id  (`me` = el perfil propio tal como lo ven los demás).
 * Si el perfil es privado, sólo se muestran nombre y avatar.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseIcon from '../components/BaseIcon.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import RatingStars from '../components/RatingStars.vue'
import { typeMeta } from '../lib/catalog'
import { useUiStore } from '../stores/ui'
import { useProfileStore } from '../stores/profile'
import { ApiError } from '../lib/api'
import { socialService } from '../services/socialService'
import type { PublicProfile } from '../types/review'

const route = useRoute()
const ui = useUiStore()

const profile = ref<PublicProfile | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let requestId = 0

async function load(id: string) {
  const current = ++requestId
  loading.value = true
  error.value = null
  try {
    const res = await socialService.publicProfile(id)
    if (current === requestId) profile.value = res
  } catch (e) {
    if (current !== requestId) return
    profile.value = null
    error.value = e instanceof ApiError && e.status === 404 ? 'Este usuario no existe.' : 'No se pudo cargar el perfil.'
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(
  () => String(route.params.id ?? ''),
  (id) => {
    if (id) void load(id)
  },
  { immediate: true },
)

// Si es el perfil propio y cambia la visibilidad desde "Cuenta", recargar.
const ownProfile = useProfileStore()
watch(
  () => ownProfile.profile.isPublic,
  () => {
    if (profile.value?.isSelf) void load(String(route.params.id ?? ''))
  },
)

const canSeeEntries = computed(() => profile.value != null && (profile.value.isPublic || profile.value.isSelf))
/** Sólo obras con algo que contar: calificación, reseña o nota pública. */
const entries = computed(() =>
  (profile.value?.entries ?? []).filter((e) => e.rating != null || e.review.trim() || e.notes?.trim()),
)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="public-profile">
    <div v-if="loading && !profile" class="public-profile__loading">
      <BaseSpinner size="sm" /> Cargando perfil…
    </div>

    <EmptyState v-else-if="error" icon="person-x" :title="error" />

    <template v-else-if="profile">
      <div v-if="profile.isSelf" class="public-profile__self-banner">
        <BaseIcon name="eye" />
        <span v-if="profile.isPublic">Así ven tu perfil los demás.</span>
        <span v-else>
          Tu perfil es <strong>privado</strong>: los demás sólo ven tu nombre y tus reseñas en cada obra.
        </span>
        <BaseButton v-if="!profile.isPublic" variant="outline" @click="ui.openSettings()">
          Hacerlo público
        </BaseButton>
      </div>

      <header class="public-profile__head">
        <div class="public-profile__avatar">
          <img v-if="profile.user.avatar" :src="profile.user.avatar" alt="" />
          <span v-else>{{ profile.user.name.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="public-profile__identity">
          <h1 class="public-profile__name">{{ profile.user.name }}</h1>
          <p v-if="profile.user.handle" class="public-profile__handle">@{{ profile.user.handle }}</p>
          <p v-if="canSeeEntries && profile.tagline" class="public-profile__tagline">{{ profile.tagline }}</p>
        </div>
      </header>

      <blockquote v-if="canSeeEntries && profile.quote" class="public-profile__quote">
        “{{ profile.quote }}”
      </blockquote>

      <EmptyState
        v-if="!canSeeEntries"
        icon="lock"
        title="Perfil privado"
        text="Esta persona decidió no mostrar su colección. Sus reseñas siguen visibles en cada obra."
      />

      <EmptyState
        v-else-if="!entries.length"
        icon="journal"
        title="Aún no hay reseñas"
        text="Cuando califique o comente obras, aparecerán aquí."
      />

      <section v-else>
        <h2 class="public-profile__section-title">Reseñas y notas</h2>
        <ul class="public-profile__list">
          <li v-for="e in entries" :key="e.id" class="public-profile__entry">
            <img v-if="e.cover" :src="e.cover" alt="" class="public-profile__cover" loading="lazy" />
            <div v-else class="public-profile__cover public-profile__cover--empty" aria-hidden="true">
              <BaseIcon :name="typeMeta(e.type).icon" />
            </div>

            <div class="public-profile__entry-body">
              <div class="public-profile__entry-head">
                <span class="public-profile__type">{{ typeMeta(e.type).label }}</span>
                <span class="public-profile__date">{{ formatDate(e.updatedAt) }}</span>
              </div>
              <h3 class="public-profile__title">{{ e.title }}</h3>
              <p v-if="e.creator || e.year" class="public-profile__meta">
                {{ [e.creator, e.year].filter(Boolean).join(' · ') }}
              </p>
              <RatingStars v-if="e.rating != null" :value="e.rating" />

              <p v-if="e.review.trim()" class="public-profile__review">{{ e.review }}</p>

              <div v-if="e.notes?.trim()" class="public-profile__note">
                <span class="public-profile__note-label"><BaseIcon name="globe2" /> Nota</span>
                <p>{{ e.notes }}</p>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.public-profile {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 860px;
}

.public-profile__loading {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text-muted);
}

.public-profile__self-banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.public-profile__self-banner strong {
  color: var(--color-text);
}

.public-profile__self-banner :deep(button) {
  margin-left: auto;
}

.public-profile__head {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.public-profile__avatar {
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-size: 2rem;
  font-weight: 800;
}

.public-profile__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.public-profile__identity {
  min-width: 0;
}

.public-profile__name {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-text);
}

.public-profile__handle {
  margin: 2px 0 0;
  color: var(--color-text-subtle);
}

.public-profile__tagline {
  margin: var(--space-xs) 0 0;
  color: var(--color-text-muted);
}

.public-profile__quote {
  margin: 0;
  padding-left: var(--space-md);
  border-left: 3px solid var(--color-accent);
  color: var(--color-text-muted);
  font-style: italic;
}

.public-profile__section-title {
  margin: 0 0 var(--space-md);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.public-profile__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.public-profile__entry {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.public-profile__cover {
  width: 72px;
  aspect-ratio: 2 / 3;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface-2);
}

.public-profile__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-subtle);
}

.public-profile__entry-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.public-profile__entry-head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-sm);
}

.public-profile__type {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-accent);
}

.public-profile__date {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.public-profile__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
}

.public-profile__meta {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.public-profile__review {
  margin: var(--space-xs) 0 0;
  color: var(--color-text);
  font-size: 0.9375rem;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.public-profile__note {
  margin-top: var(--space-xs);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.public-profile__note-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-subtle);
}

.public-profile__note p {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

@media (max-width: 520px) {
  .public-profile__name {
    font-size: 1.5rem;
  }

  .public-profile__avatar {
    width: 64px;
    height: 64px;
  }
}
</style>
