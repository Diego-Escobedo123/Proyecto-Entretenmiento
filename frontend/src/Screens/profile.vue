<script setup lang="ts">
/**
 * Perfil — una sola página para el perfil propio (/profile) y el de los
 * demás (/users/:id), como en Letterboxd: todos ven lo mismo y su dueño,
 * además, los botones para editar.
 *
 * Arriba la identidad (frase y cita sólo si las escribió) con sus números;
 * luego sus 4 favoritas (las elige él), actividad reciente y cómo califica.
 * Si el perfil es público sigue su ADN cultural y su constancia; si es
 * privado (y por eso sólo lo ve su dueño), sus reseñas recientes. Después las
 * listas públicas y, sólo para su dueño, "Tu retrato cultural".
 *
 * Con perfil privado, los demás sólo ven nombre, contadores y listas públicas.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseIcon from '../components/BaseIcon.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import RatingStars from '../components/RatingStars.vue'
import RatingHistogram from '../components/RatingHistogram.vue'
import CulturalPortrait from '../components/CulturalPortrait.vue'
import ListCard from '../components/lists/ListCard.vue'
import FollowButton from '../components/social/FollowButton.vue'
import UserAvatar from '../components/social/UserAvatar.vue'
import FavoritesPicker from '../components/profile/FavoritesPicker.vue'
import DnaCard from '../components/profile/DnaCard.vue'
import ConstancyCard from '../components/profile/ConstancyCard.vue'
import { statusLabel, typeMeta } from '../lib/catalog'
import { formatDay } from '../lib/dates'
import { ApiError } from '../lib/api'
import { socialService } from '../services/socialService'
import { useMediaStore } from '../stores/media'
import { useProfileStore } from '../stores/profile'
import { useUiStore } from '../stores/ui'
import type { LogEntry } from '../types/log'
import type { PublicEntry, PublicProfile } from '../types/review'

const route = useRoute()
const ui = useUiStore()
const media = useMediaStore()
const ownProfile = useProfileStore()

/** /profile es el propio; /users/:id, el de cualquiera (también puede ser el propio). */
const userId = computed(() => (route.name === 'profile' ? 'me' : String(route.params.id ?? '')))

const profile = ref<PublicProfile | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let requestId = 0

async function load() {
  const current = ++requestId
  loading.value = true
  error.value = null
  try {
    const res = await socialService.publicProfile(userId.value)
    if (current === requestId) profile.value = res
  } catch (e) {
    if (current !== requestId) return
    profile.value = null
    error.value = e instanceof ApiError && e.status === 404 ? 'Este usuario no existe.' : 'No se pudo cargar el perfil.'
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(userId, load, { immediate: true })

const isSelf = computed(() => profile.value?.isSelf ?? false)
/** Los demás no ven la colección de un perfil privado. */
const canSeeCollection = computed(() => profile.value != null && (profile.value.isPublic || profile.value.isSelf))

// El propio perfil se recarga cuando se edita desde Ajustes (nombre, frase, visibilidad…).
watch(
  () => ownProfile.profile,
  () => {
    if (isSelf.value) void load()
  },
  { deep: true },
)

watch(isSelf, (self) => {
  // "Tu retrato cultural" se calcula con la colección completa.
  if (self) void media.ensureLoaded()
})

function onFollowChange(following: boolean, followers: number) {
  if (!profile.value) return
  profile.value.isFollowing = following
  profile.value.followers = followers
}

// --- Favoritas ---
const pickingFavorites = ref(false)

function openWork(e: Pick<PublicEntry, 'type' | 'title' | 'creator' | 'year' | 'genres' | 'cover' | 'externalId'>) {
  ui.openWorkDetail({
    type: e.type,
    title: e.title,
    creator: e.creator,
    year: e.year,
    genres: e.genres,
    cover: e.cover,
    externalId: e.externalId,
  })
}

// --- Actividad reciente ---
function describeLog(log: LogEntry): string {
  const type = log.entry!.type
  if (!log.finishedAt) return `${statusLabel(type, 'in-progress')}${log.startedAt ? ` desde el ${formatDay(log.startedAt)}` : ''}`
  const status = statusLabel(type, log.abandoned ? 'abandoned' : 'completed')
  return `${status} el ${formatDay(log.finishedAt)}`
}

// --- Reseñas (y notas públicas) ---
const MAX_REVIEWS = 4
const reviews = computed(() =>
  (profile.value?.entries ?? []).filter((e) => e.review.trim() || e.notes?.trim()).slice(0, MAX_REVIEWS),
)

const nf = (n: number) => n.toLocaleString('es')
</script>

<template>
  <div class="profile">
    <div v-if="loading && !profile" class="profile__hint"><BaseSpinner size="sm" /> Cargando perfil…</div>
    <EmptyState v-else-if="error" icon="person-x" :title="error" />

    <template v-else-if="profile">
      <!-- Identidad y números -->
      <header class="card profile-head">
        <UserAvatar :user="profile.user" :size="96" :link="false" class="profile-head__avatar" />

        <div class="profile-head__identity">
          <h1 class="profile-head__name">{{ profile.user.name }}</h1>
          <p class="profile-head__handle">
            <template v-if="profile.user.handle">@{{ profile.user.handle }}</template>
            <template v-if="profile.memberSince"> · En Mosaic desde {{ profile.memberSince }}</template>
          </p>
          <p v-if="profile.tagline" class="profile-head__tagline">{{ profile.tagline }}</p>
          <blockquote v-if="profile.quote" class="profile-head__quote">“{{ profile.quote }}”</blockquote>
          <p v-else-if="isSelf && !profile.tagline" class="profile-head__empty">
            Agrega una frase que te describa desde
            <button type="button" class="profile-head__inline" @click="ui.openSettings()">Editar perfil</button>.
          </p>
        </div>

        <div class="profile-head__actions">
          <template v-if="isSelf">
            <BaseButton variant="outline" @click="ui.openSettings()"><BaseIcon name="pencil" /> Editar perfil</BaseButton>
            <button type="button" class="profile-head__visibility" title="Cambiar en Editar perfil" @click="ui.openSettings()">
              <BaseIcon :name="profile.isPublic ? 'globe' : 'lock-fill'" />
              {{ profile.isPublic ? 'Perfil público' : 'Perfil privado' }}
            </button>
          </template>
          <FollowButton v-else :user-id="profile.user.id" :following="profile.isFollowing" @change="onFollowChange" />
        </div>

        <nav class="profile-stats" aria-label="Números del perfil">
          <component
            :is="isSelf ? 'RouterLink' : 'span'"
            :to="isSelf ? '/collection' : undefined"
            class="profile-stats__item"
            :class="{ 'is-muted': !canSeeCollection }"
          >
            <strong>{{ nf(profile.counts.works) }}</strong> obras
          </component>
          <component
            :is="isSelf ? 'RouterLink' : 'span'"
            :to="isSelf ? '/diary?tab=review' : undefined"
            class="profile-stats__item"
            :class="{ 'is-muted': !canSeeCollection }"
          >
            <strong>{{ nf(profile.counts.finishedThisYear) }}</strong> este año
          </component>
          <component :is="isSelf ? 'RouterLink' : 'span'" :to="isSelf ? '/lists' : undefined" class="profile-stats__item">
            <strong>{{ nf(profile.counts.lists) }}</strong> {{ profile.counts.lists === 1 ? 'lista' : 'listas' }}
          </component>
          <RouterLink :to="`/users/${profile.user.id}/followers`" class="profile-stats__item">
            <strong>{{ nf(profile.followers) }}</strong> {{ profile.followers === 1 ? 'seguidor' : 'seguidores' }}
          </RouterLink>
          <RouterLink :to="`/users/${profile.user.id}/following`" class="profile-stats__item">
            <strong>{{ nf(profile.following) }}</strong> {{ profile.following === 1 ? 'seguido' : 'seguidos' }}
          </RouterLink>
        </nav>
      </header>

      <p v-if="isSelf && !profile.isPublic" class="profile__banner">
        <BaseIcon name="lock" />
        <span>
          Tu perfil es <strong>privado</strong>: los demás sólo ven tu nombre, tus contadores y tus listas públicas. Tus
          reseñas siguen visibles en cada obra.
        </span>
        <BaseButton variant="outline" @click="ui.openSettings()">Hacerlo público</BaseButton>
      </p>
      <p v-else-if="!isSelf && profile.isFollowing && !profile.isPublic" class="profile__banner">
        <BaseIcon name="lock" /> Sigues a esta persona, pero su perfil es privado: su actividad no aparece en tu feed. Sus
        listas públicas, sí.
      </p>

      <EmptyState
        v-if="!canSeeCollection"
        icon="lock"
        title="Perfil privado"
        text="Esta persona decidió no mostrar su colección. Sus reseñas siguen visibles en cada obra."
      />

      <template v-else>
        <!-- Favoritas: las elige su dueño -->
        <section v-if="profile.favorites.length || isSelf" class="profile-section">
          <header class="profile-section__head">
            <h2 class="profile-section__title"><BaseIcon name="heart" /> {{ isSelf ? 'Tus 4 favoritas' : 'Sus 4 favoritas' }}</h2>
            <button v-if="isSelf" type="button" class="profile-section__link" @click="pickingFavorites = true">
              <BaseIcon name="pencil" /> {{ profile.favorites.length ? 'Cambiar' : 'Elegir' }}
            </button>
          </header>
          <ol class="favorites">
            <li v-for="f in profile.favorites" :key="f.id">
              <button type="button" class="favorites__item" :aria-label="`Ver ficha de ${f.title}`" @click="openWork(f)">
                <img v-if="f.cover" :src="f.cover" alt="" class="favorites__cover" loading="lazy" />
                <span v-else class="favorites__cover favorites__cover--empty" aria-hidden="true">
                  <BaseIcon :name="typeMeta(f.type).icon" />
                </span>
                <span class="favorites__title">{{ f.title }}</span>
                <span class="favorites__meta">{{ typeMeta(f.type).label }}<template v-if="f.year"> · {{ f.year }}</template></span>
              </button>
            </li>
            <template v-if="isSelf">
              <li v-for="n in 4 - profile.favorites.length" :key="`empty-${n}`">
                <button type="button" class="favorites__item" @click="pickingFavorites = true">
                  <span class="favorites__cover favorites__cover--slot"><BaseIcon name="plus-lg" /></span>
                  <span class="favorites__meta">Elegir</span>
                </button>
              </li>
            </template>
          </ol>
        </section>

        <!-- Actividad reciente + cómo califica -->
        <div class="profile-columns">
          <section class="card profile-section">
            <header class="profile-section__head">
              <h2 class="profile-section__title"><BaseIcon name="journal-bookmark" /> Actividad reciente</h2>
              <RouterLink v-if="isSelf" to="/diary" class="profile-section__link">Ver diario <BaseIcon name="arrow-right" /></RouterLink>
            </header>
            <p v-if="!profile.recent.length" class="profile__hint">
              {{ isSelf ? 'Cuando empieces o termines algo, aparecerá aquí.' : 'Todavía no hay actividad.' }}
            </p>
            <ul v-else class="recent">
              <li v-for="log in profile.recent" :key="log.id">
                <button type="button" class="recent__row" @click="openWork(log.entry!)">
                  <img v-if="log.entry!.cover" :src="log.entry!.cover" alt="" class="recent__cover" loading="lazy" />
                  <span v-else class="recent__cover recent__cover--empty" aria-hidden="true">
                    <BaseIcon :name="typeMeta(log.entry!.type).icon" />
                  </span>
                  <span class="recent__info">
                    <span class="recent__title">{{ log.entry!.title }}</span>
                    <span class="recent__meta">
                      {{ describeLog(log) }}
                      <span v-if="log.repeat" class="recent__repeat"><BaseIcon name="arrow-repeat" /> Otra vez</span>
                    </span>
                  </span>
                  <RatingStars v-if="log.rating != null" :value="log.rating" class="recent__stars" />
                </button>
              </li>
            </ul>
          </section>

          <section class="card profile-section">
            <h2 class="profile-section__title"><BaseIcon name="bar-chart" /> {{ isSelf ? 'Cómo calificas' : 'Cómo califica' }}</h2>
            <RatingHistogram
              v-if="profile.ratings.count"
              :histogram="profile.ratings.histogram"
              :average="profile.ratings.average"
              :count="profile.ratings.count"
            />
            <p v-else class="profile__hint">Todavía no hay calificaciones.</p>
          </section>
        </div>

        <!-- Perfil público: ADN cultural y constancia (lo mismo para todos) -->
        <div v-if="profile.isPublic" class="profile-columns profile-columns--even">
          <DnaCard
            :top-genres="profile.dna.topGenres"
            :favorite-decade="profile.dna.favoriteDecade"
            :dominant-label="profile.dna.dominantType ? typeMeta(profile.dna.dominantType).plural : null"
            :completion-rate="profile.dna.completionRate"
            :self="isSelf"
          />
          <ConstancyCard :days="profile.activity" :self="isSelf" />
        </div>

        <!-- Perfil privado (sólo lo ve su dueño): reseñas y notas públicas -->
        <section v-else-if="reviews.length" class="profile-section">
          <h2 class="profile-section__title"><BaseIcon name="chat-quote" /> Reseñas recientes</h2>
          <ul class="reviews">
            <li v-for="e in reviews" :key="e.id" class="reviews__item">
              <button type="button" class="reviews__cover-btn" :aria-label="`Ver ficha de ${e.title}`" @click="openWork(e)">
                <img v-if="e.cover" :src="e.cover" alt="" class="reviews__cover" loading="lazy" />
                <span v-else class="reviews__cover reviews__cover--empty" aria-hidden="true">
                  <BaseIcon :name="typeMeta(e.type).icon" />
                </span>
              </button>
              <div class="reviews__body">
                <button type="button" class="reviews__title" @click="openWork(e)">{{ e.title }}</button>
                <p class="reviews__meta">
                  {{ [typeMeta(e.type).label, e.creator, e.year].filter(Boolean).join(' · ') }}
                </p>
                <RatingStars v-if="e.rating != null" :value="e.rating" />
                <p v-if="e.review.trim()" class="reviews__text">{{ e.review }}</p>
                <div v-if="e.notes?.trim()" class="reviews__note">
                  <span class="reviews__note-label"><BaseIcon name="globe2" /> Nota</span>
                  <p>{{ e.notes }}</p>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </template>

      <!-- Listas públicas (se ven aunque el perfil sea privado: cada lista decide) -->
      <section v-if="profile.lists.length" class="profile-section">
        <header class="profile-section__head">
          <h2 class="profile-section__title"><BaseIcon name="card-list" /> {{ isSelf ? 'Tus listas públicas' : 'Listas' }}</h2>
          <RouterLink v-if="isSelf" to="/lists" class="profile-section__link">Todas tus listas <BaseIcon name="arrow-right" /></RouterLink>
        </header>
        <div class="profile-lists">
          <ListCard v-for="l in profile.lists" :key="l.id" :list="l" />
        </div>
      </section>

      <!-- Sólo para su dueño -->
      <CulturalPortrait v-if="isSelf && media.entries.length" :hide-shared="profile.isPublic" />

      <FavoritesPicker
        v-if="pickingFavorites"
        :initial="profile.favorites.map((f) => f.id)"
        @close="pickingFavorites = false"
        @saved="load"
      />
    </template>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.profile__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

/* --- Encabezado --- */
.profile-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    'avatar identity actions'
    'stats stats stats';
  gap: var(--space-md) var(--space-lg);
  align-items: start;
}

.profile-head__avatar {
  grid-area: avatar;
  box-shadow: 0 0 0 3px var(--color-accent);
}

.profile-head__identity {
  grid-area: identity;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-head__name {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.profile-head__handle {
  margin: 0;
  color: var(--color-text-muted);
}

.profile-head__tagline {
  margin: 4px 0 0;
  font-weight: 700;
  color: var(--color-accent);
}

.profile-head__quote {
  margin: 4px 0 0;
  padding-left: var(--space-md);
  border-left: 3px solid var(--color-accent);
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--color-text-muted);
}

.profile-head__empty {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: var(--color-text-subtle);
}

.profile-head__inline {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
}

.profile-head__actions {
  grid-area: actions;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-sm);
}

.profile-head__visibility {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
}

.profile-head__visibility:hover {
  color: var(--color-text);
}

.profile-stats {
  grid-area: stats;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.profile-stats__item {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--color-surface-2);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.profile-stats__item strong {
  font-size: 1.0625rem;
  color: var(--color-text);
}

a.profile-stats__item:hover {
  color: var(--color-accent);
}

.profile-stats__item.is-muted {
  opacity: 0.6;
}

.profile__banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.profile__banner > span {
  flex: 1;
  min-width: 220px;
}

.profile__banner strong {
  color: var(--color-text);
}

.profile__banner :deep(button) {
  margin-left: auto;
}

/* --- Secciones --- */
.profile-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

.profile-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.profile-section__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.profile-section__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
}

.profile-columns {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: var(--space-md);
  align-items: start;
}

.profile-columns > * {
  min-width: 0;
}

.profile-columns--even {
  grid-template-columns: 1fr 1fr;
}

/* --- Favoritas --- */
.favorites {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  /* minmax(0, 1fr): un título largo no ensancha su columna (todas las portadas iguales). */
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-md);
  max-width: 760px;
}

.favorites__item {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.favorites__cover {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-md);
  object-fit: cover;
  background: var(--color-surface-2);
  transition: transform 0.15s ease;
}

.favorites__item:hover .favorites__cover {
  transform: translateY(-3px);
}

.favorites__cover--empty,
.favorites__cover--slot {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  color: var(--color-text-subtle);
}

.favorites__cover--slot {
  border: 2px dashed var(--color-border);
  background: none;
}

.favorites__title {
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorites__meta {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

/* --- Actividad reciente --- */
.recent {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recent__row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px;
  border: none;
  border-radius: var(--radius-md);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.recent__row:hover,
.recent__row:focus-visible {
  background: var(--color-surface-2);
}

.recent__cover {
  width: 36px;
  height: 54px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface-2);
}

.recent__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
}

.recent__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.recent__title {
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.recent__repeat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  color: var(--color-accent);
}

.recent__stars {
  flex-shrink: 0;
}

/* --- Reseñas --- */
.reviews {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.reviews__item {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.reviews__cover-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.reviews__cover {
  display: block;
  width: 64px;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface-2);
}

.reviews__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-subtle);
}

.reviews__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.reviews__title {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.reviews__title:hover {
  color: var(--color-accent);
}

.reviews__meta {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.reviews__text {
  margin: var(--space-xs) 0 0;
  color: var(--color-text);
  font-size: 0.9375rem;
  line-height: 1.55;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.reviews__note {
  align-self: stretch;
  margin-top: var(--space-xs);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.reviews__note-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-subtle);
}

.reviews__note p {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.profile-lists {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
}

@media (max-width: 900px) {
  .profile-columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .profile-head {
    grid-template-columns: auto 1fr;
    grid-template-areas:
      'avatar identity'
      'actions actions'
      'stats stats';
  }

  .profile-head__actions {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }

  .profile-head__name {
    font-size: 1.5rem;
  }

  .profile-head :deep(.user-avatar) {
    width: 64px !important;
    height: 64px !important;
  }

  .favorites {
    gap: var(--space-sm);
  }

  .favorites__title {
    font-size: 0.8125rem;
  }

  .recent__stars {
    display: none;
  }
}
</style>
