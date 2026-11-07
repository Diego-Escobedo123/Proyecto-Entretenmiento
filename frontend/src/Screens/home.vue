<script setup lang="ts">
/**
 * Inicio, de arriba a abajo por intención:
 * - lo que estás haciendo: Continuar (con atajos para anotar el avance);
 * - qué hacer después: ¿Qué sigue? (ideas de tu wishlist) y Para ti;
 * - cómo vas: tu reto del año y lo último que terminaste;
 * - qué hacen los demás: la actividad de quienes sigues, al final porque es
 *   una lista que crece y no debe empujar lo demás hacia abajo.
 * No repite la colección (Mi colección), el diario (Diario) ni tu retrato
 * cultural (Perfil).
 */
import { coverOk, vCover } from '../lib/cover'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import SectionHeader from '../components/SectionHeader.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseIcon from '../components/BaseIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import ProgressBar from '../components/ProgressBar.vue'
import RatingStars from '../components/RatingStars.vue'
import ContinueConsumingCard from '../components/home/ContinueConsumingCard.vue'
import GettingStarted from '../components/home/GettingStarted.vue'
import FollowingFeed from '../components/home/FollowingFeed.vue'
import WhatsNext from '../components/home/WhatsNext.vue'
import ExploreRow from '../components/explore/ExploreRow.vue'
import { MEDIA_TYPES, statusLabel, typeMeta } from '../lib/catalog'
import { formatDay } from '../lib/dates'
import { goalProgress } from '../lib/yearStats'
import { homeInsights, insightOfTheDay } from '../lib/homeInsight'
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

// Al terminar o empezar algo desde Inicio (Continuar, ¿Qué sigue?), el diario
// cambia: se vuelve a leer para que el reto y "Lo último que terminaste" se
// pongan al día sin recargar.
let reloadTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => entries.value.map((e) => `${e.id}:${e.status}`).join(),
  () => {
    if (!diaryLoaded.value) return
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(async () => {
      try {
        logs.value = await logService.list()
      } catch {
        // Se queda con lo que había; al volver a Inicio se recarga.
      }
    }, 600)
  },
)
onBeforeUnmount(() => clearTimeout(reloadTimer))

const GOAL_LABEL = new Map<string, { label: string; singular: string; icon: string }>([
  ['all', { label: 'obras', singular: 'obra', icon: 'collection' }],
  ...MEDIA_TYPES.map(
    (t) => [t.value, { label: t.plural.toLowerCase(), singular: t.label.toLowerCase(), icon: t.icon }] as const,
  ),
])

const goalRows = computed(() =>
  goals.value.map((g) => {
    const done = goalProgress(logs.value, currentYear, g.type)
    return {
      goal: g,
      done,
      percent: Math.min(100, Math.round((done / g.target) * 100)),
      ...(GOAL_LABEL.get(g.type) ?? { label: 'obras', singular: 'obra', icon: 'collection' }),
    }
  }),
)

/** El dato bajo el saludo: cambia cada día (racha, meta cerca, género del mes…). */
const insight = computed(() =>
  insightOfTheDay(
    homeInsights(
      logs.value,
      goalRows.value.map((r) => ({ done: r.done, target: r.goal.target, singular: r.singular, plural: r.label })),
      currentYear,
    ),
  ),
)

const MAX_RECENT = 5
const recentlyFinished = computed(() =>
  logs.value.filter((l) => l.entry && l.finishedAt && !l.abandoned).slice(0, MAX_RECENT),
)

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
  <!-- Siluetas con la forma de Inicio (saludo, Continuar y las dos columnas) mientras carga -->
  <div v-if="loading && !media.loaded" class="home__skeleton" aria-busy="true" aria-label="Cargando inicio">
    <span class="home__skeleton-line home__skeleton-line--title mosaic-skeleton" />
    <span class="home__skeleton-line mosaic-skeleton" />
    <div class="home__continue">
      <div v-for="n in 3" :key="n" class="home__skeleton-block mosaic-skeleton" />
    </div>
    <div class="home__columns">
      <div v-for="n in 2" :key="n" class="home__skeleton-block home__skeleton-block--tall mosaic-skeleton" />
    </div>
  </div>

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
        <Transition name="home-insight">
          <span v-if="diaryLoaded" class="home__insight">{{ insight }}</span>
        </Transition>
      </p>
    </header>

    <!-- Para quien recién llega; se oculta sola al completar las tareas o con la ✕ -->
    <GettingStarted />

    <section>
      <SectionHeader title="Continuar" />
      <div v-if="inProgress.length" class="home__continue">
        <ContinueConsumingCard
          v-for="(entry, i) in inProgress"
          :key="entry.id"
          class="mosaic-enter"
          :style="{ '--i': i }"
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

    <!-- Ideas de la wishlist para hoy (no aparece si está vacía) -->
    <WhatsNext />

    <!-- Recomendaciones según tus gustos (la misma fila de Explorar; se oculta si no hay) -->
    <ExploreRow
      section="foryou"
      :type="null"
      title="Para ti"
      icon="stars"
      subtitle="A partir de lo que más te gustó de tu colección. Hay más en Explorar."
    />

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
              <img v-if="coverOk(log.entry!.cover)" v-cover="log.entry!.cover" :src="log.entry!.cover" alt="" class="home__recent-cover" loading="lazy" />
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

    <!-- Al final: es una lista que crece ("Ver más") y no debe empujar lo demás hacia abajo -->
    <FollowingFeed />
  </template>
</template>

<style scoped>
/* Siluetas de carga (el brillo lo pone .mosaic-skeleton, en style.css). */
.home__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.home__skeleton-line {
  width: min(320px, 70%);
  height: 14px;
  border-radius: 999px;
}

.home__skeleton-line--title {
  width: min(220px, 50%);
  height: 28px;
}

.home__skeleton-block {
  height: 140px;
  border-radius: var(--radius-lg);
}

.home__skeleton-block--tall {
  height: 260px;
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

/* El dato del día aparece cuando carga el diario (el espacio ya está reservado). */
.home__insight {
  display: inline-block;
}

.home-insight-enter-active {
  transition: opacity var(--dur-base) ease, transform var(--dur-base) var(--ease-out);
}

.home-insight-enter-from {
  opacity: 0;
  transform: translateY(4px);
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
