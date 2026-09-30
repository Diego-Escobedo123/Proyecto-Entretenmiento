<script setup lang="ts">
/**
 * Inicio — "¿qué sigue?": lo que tienes a medias para retomarlo, cómo vas
 * con tu reto del año, lo último que terminaste y la actividad de quienes
 * sigues. No repite la colección
 * (Mi colección), el diario (Diario) ni tu retrato cultural (Perfil).
 */
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import SectionHeader from '../components/SectionHeader.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseIcon from '../components/BaseIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import ProgressBar from '../components/ProgressBar.vue'
import RatingStars from '../components/RatingStars.vue'
import ContinueConsumingCard from '../components/home/ContinueConsumingCard.vue'
import FollowingFeed from '../components/home/FollowingFeed.vue'
import { MEDIA_TYPES, statusLabel, typeMeta } from '../lib/catalog'
import { formatDay } from '../lib/dates'
import { finishedIn, goalProgress } from '../lib/yearStats'
import { goalService } from '../services/goalService'
import { logService } from '../services/logService'
import { useMediaStore } from '../stores/media'
import { useProfileStore } from '../stores/profile'
import { useUiStore } from '../stores/ui'
import type { Goal } from '../types/goal'
import type { LogEntry } from '../types/log'

const media = useMediaStore()
const ui = useUiStore()
const router = useRouter()
const { entries, loading, isEmpty } = storeToRefs(media)
const { profile } = storeToRefs(useProfileStore())

const currentYear = new Date().getFullYear()
const firstName = computed(() => profile.value.name.split(' ')[0] || profile.value.name)

// --- Continuar: lo que está en curso, lo más reciente primero ---
const MAX_CONTINUE = 6
const inProgress = computed(() =>
  entries.value
    .filter((e) => e.status === 'in-progress')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CONTINUE),
)

// --- Reto y últimas terminadas: salen del diario ---
const logs = ref<LogEntry[]>([])
const goals = ref<Goal[]>([])
const diaryLoaded = ref(false)

onMounted(async () => {
  const [l, g] = await Promise.allSettled([logService.list(), goalService.list(currentYear)])
  if (l.status === 'fulfilled') logs.value = l.value
  if (g.status === 'fulfilled') goals.value = g.value
  diaryLoaded.value = true
})

const GOAL_LABEL = new Map<string, { label: string; icon: string }>([
  ['all', { label: 'obras', icon: 'collection' }],
  ...MEDIA_TYPES.map((t) => [t.value, { label: t.plural.toLowerCase(), icon: t.icon }] as const),
])

const goalRows = computed(() =>
  goals.value.map((g) => {
    const done = goalProgress(logs.value, currentYear, g.type)
    return {
      goal: g,
      done,
      percent: Math.min(100, Math.round((done / g.target) * 100)),
      ...(GOAL_LABEL.get(g.type) ?? { label: 'obras', icon: 'collection' }),
    }
  }),
)

const MAX_RECENT = 5
const recentlyFinished = computed(() =>
  logs.value.filter((l) => l.entry && l.finishedAt && !l.abandoned).slice(0, MAX_RECENT),
)
const finishedThisYear = computed(() => finishedIn(logs.value, currentYear).length)

function openLog(log: LogEntry) {
  const e = log.entry!
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
</script>

<template>
  <template v-if="loading && !media.loaded">
    <p class="home__loading">Cargando…</p>
  </template>

  <EmptyState
    v-else-if="isEmpty"
    icon="collection-play"
    title="Aún no has registrado ninguna obra"
    text="Empieza a construir tu perfil cultural: agrega la última película, serie, libro, juego o álbum que disfrutaste."
  >
    <BaseButton @click="ui.openCreateEntry()">Agregar mi primera obra</BaseButton>
  </EmptyState>

  <template v-else>
    <header class="home__hello">
      <h1 class="home__title">Hola, {{ firstName }}</h1>
      <p class="home__subtitle">
        <template v-if="diaryLoaded">
          Llevas {{ finishedThisYear }} {{ finishedThisYear === 1 ? 'obra terminada' : 'obras terminadas' }} en {{ currentYear }}.
        </template>
      </p>
    </header>

    <section>
      <SectionHeader title="Continuar" />
      <div v-if="inProgress.length" class="home__continue">
        <ContinueConsumingCard
          v-for="entry in inProgress"
          :key="entry.id"
          :entry="entry"
          @open="ui.openWorkDetail(entry)"
          @update="ui.openEditEntry(entry.id)"
        />
      </div>
      <EmptyState
        v-else
        compact
        icon="play-circle"
        title="No tienes nada en curso"
        text="Cuando empieces a ver, leer o jugar algo, aparecerá aquí para retomarlo."
      >
        <BaseButton variant="outline" @click="ui.openCreateEntry()">+ Agregar obra</BaseButton>
      </EmptyState>
    </section>

    <div class="home__columns">
      <section class="home__card">
        <header class="home__card-head">
          <h2 class="home__card-title"><BaseIcon name="trophy" /> Reto {{ currentYear }}</h2>
          <RouterLink to="/diary?tab=review" class="home__card-link">
            {{ goals.length ? 'Ver resumen' : 'Ponte una meta' }} <BaseIcon name="arrow-right" />
          </RouterLink>
        </header>

        <ul v-if="goalRows.length" class="home__goals">
          <li v-for="r in goalRows" :key="r.goal.id" class="home__goal">
            <span class="home__goal-text">
              <BaseIcon :name="r.icon" />
              <strong>{{ r.done }}</strong> de {{ r.goal.target }} {{ r.label }}
              <span class="home__goal-pct">{{ r.percent }}%</span>
            </span>
            <ProgressBar :percent="r.percent" />
          </li>
        </ul>
        <p v-else-if="diaryLoaded" class="home__hint">
          Sin metas para {{ currentYear }}. Por ejemplo: leer 12 libros o ver 50 películas.
        </p>
      </section>

      <section class="home__card">
        <header class="home__card-head">
          <h2 class="home__card-title"><BaseIcon name="journal-bookmark" /> Lo último que terminaste</h2>
          <RouterLink to="/diary" class="home__card-link">Ver diario <BaseIcon name="arrow-right" /></RouterLink>
        </header>

        <ul v-if="recentlyFinished.length" class="home__recent">
          <li v-for="log in recentlyFinished" :key="log.id">
            <button type="button" class="home__recent-row" @click="openLog(log)">
              <img v-if="log.entry!.cover" :src="log.entry!.cover" alt="" class="home__recent-cover" loading="lazy" />
              <span v-else class="home__recent-cover home__recent-cover--empty" aria-hidden="true">
                <BaseIcon :name="typeMeta(log.entry!.type).icon" />
              </span>
              <span class="home__recent-info">
                <span class="home__recent-title">{{ log.entry!.title }}</span>
                <span class="home__recent-meta">
                  {{ statusLabel(log.entry!.type, 'completed') }} el {{ formatDay(log.finishedAt!) }}
                  <template v-if="log.repeat"> · otra vez</template>
                </span>
              </span>
              <RatingStars v-if="log.rating != null" :value="log.rating" class="home__recent-stars" />
            </button>
          </li>
        </ul>
        <p v-else-if="diaryLoaded" class="home__hint">
          Cuando termines algo, aparecerá aquí.
          <button type="button" class="home__inline-link" @click="router.push('/collection')">Ir a mi colección</button>
        </p>
      </section>
    </div>

    <FollowingFeed />
  </template>
</template>

<style scoped>
.home__loading {
  color: var(--color-text-muted);
}

.home__hello {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.home__title {
  margin: 0;
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-text);
}

.home__subtitle {
  margin: 0;
  min-height: 1.5em;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.home__continue {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-md);
}

.home__columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-md);
  align-items: start;
}

.home__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.home__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.home__card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-text);
}

.home__card-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-accent);
}

.home__hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.home__inline-link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
}

.home__goals {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.home__goal {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.home__goal-text {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
}

.home__goal-pct {
  margin-left: auto;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.home__recent {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.home__recent-row {
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

.home__recent-row:hover,
.home__recent-row:focus-visible {
  background: var(--color-surface-2);
}

.home__recent-cover {
  width: 36px;
  height: 54px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface-2);
}

.home__recent-cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
}

.home__recent-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.home__recent-title {
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home__recent-meta {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.home__recent-stars {
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .home__continue,
  .home__columns {
    grid-template-columns: 1fr;
  }

  .home__recent-stars {
    display: none;
  }
}
</style>
