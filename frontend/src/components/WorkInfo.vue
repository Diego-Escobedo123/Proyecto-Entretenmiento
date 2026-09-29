<script setup lang="ts">
/**
 * WorkInfo — ficha extendida de una obra del catálogo externo: sinopsis,
 * datos clave, reparto (películas/series), canciones (álbumes) y dónde
 * verla, leerla, jugarla o escucharla. Cada enlace lleva directo a la
 * plataforma o tienda. Obras ingresadas a mano (sin `externalId`) no
 * muestran nada.
 *
 * Uso:
 *   <WorkInfo :type="work.type" :external-id="work.externalId" />
 */
import { computed, ref, watch } from 'vue'
import BaseIcon from './BaseIcon.vue'
import BaseSpinner from './BaseSpinner.vue'
import { detailsService, hasDetails } from '../services/detailsService'
import { regionName } from '../lib/region'
import type { WorkDetails } from '../types/details'
import type { MediaType } from '../types/media'

const props = defineProps<{ type: MediaType; externalId: string | null }>()

const data = ref<WorkDetails | null>(null)
const loading = ref(false)
const overviewExpanded = ref(false)
const tracksExpanded = ref(false)
let requestId = 0

async function load() {
  data.value = null
  overviewExpanded.value = false
  tracksExpanded.value = false
  if (!hasDetails(props.externalId)) return
  const current = ++requestId
  loading.value = true
  try {
    const res = await detailsService.get(props.externalId)
    if (current === requestId) data.value = res
  } catch {
    // Sin ficha: el modal sigue mostrando los datos básicos y las reseñas.
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(() => props.externalId, load, { immediate: true })

const WHERE_TITLE: Record<MediaType, string> = {
  movie: 'Dónde verla',
  series: 'Dónde verla',
  book: 'Dónde leerlo',
  game: 'Dónde jugarlo',
  music: 'Dónde escucharlo',
}

const LONG_OVERVIEW = 280
const INITIAL_TRACKS = 8

const visibleTracks = computed(() => {
  const all = data.value?.tracks ?? []
  return tracksExpanded.value ? all : all.slice(0, INITIAL_TRACKS)
})

function formatDuration(seconds: number | null): string {
  if (seconds == null) return ''
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
</script>

<template>
  <p v-if="loading" class="work-info__hint"><BaseSpinner size="sm" /> Cargando ficha…</p>

  <div v-else-if="data" class="work-info">
    <p v-if="data.facts.length" class="work-info__facts">{{ data.facts.join(' · ') }}</p>

    <p v-for="p in data.people" :key="p.label" class="work-info__people">
      <span class="work-info__label">{{ p.label }}:</span> {{ p.names.join(', ') }}
    </p>

    <div v-if="data.overview">
      <p class="work-info__overview" :class="{ 'work-info__overview--clamped': !overviewExpanded }">
        {{ data.overview }}
      </p>
      <button
        v-if="!overviewExpanded && data.overview.length > LONG_OVERVIEW"
        type="button"
        class="work-info__more"
        @click="overviewExpanded = true"
      >
        Leer más
      </button>
    </div>

    <section v-if="data.cast.length" class="work-info__section">
      <h4 class="work-info__title"><BaseIcon name="person-video2" /> Reparto</h4>
      <ul class="work-info__cast">
        <li v-for="c in data.cast" :key="c.name + c.character" class="work-info__actor">
          <img v-if="c.photo" :src="c.photo" alt="" loading="lazy" class="work-info__photo" />
          <span v-else class="work-info__photo work-info__photo--empty" aria-hidden="true">
            <BaseIcon name="person" />
          </span>
          <span class="work-info__actor-name">{{ c.name }}</span>
          <span v-if="c.character" class="work-info__character">{{ c.character }}</span>
        </li>
      </ul>
    </section>

    <section v-if="data.tracks.length" class="work-info__section">
      <h4 class="work-info__title"><BaseIcon name="music-note-list" /> Canciones</h4>
      <ol class="work-info__tracks">
        <li v-for="(t, i) in visibleTracks" :key="i" class="work-info__track">
          <span class="work-info__track-num">{{ i + 1 }}</span>
          <span class="work-info__track-name">{{ t.name }}</span>
          <span class="work-info__track-time">{{ formatDuration(t.duration) }}</span>
        </li>
      </ol>
      <button
        v-if="!tracksExpanded && data.tracks.length > INITIAL_TRACKS"
        type="button"
        class="work-info__more"
        @click="tracksExpanded = true"
      >
        Ver las {{ data.tracks.length }} canciones
      </button>
    </section>

    <section v-if="data.where" class="work-info__section">
      <h4 class="work-info__title">
        <BaseIcon name="box-arrow-up-right" /> {{ WHERE_TITLE[type] }}
        <span v-if="data.where.region" class="work-info__region">en {{ regionName(data.where.region) }}</span>
      </h4>
      <p v-if="!data.where.groups.length" class="work-info__hint">No está disponible en plataformas en tu país.</p>
      <div v-for="g in data.where.groups" :key="g.label" class="work-info__providers">
        <span class="work-info__label">{{ g.label }}</span>
        <ul class="work-info__links">
          <li v-for="p in g.items" :key="p.name">
            <a :href="p.url" target="_blank" rel="noopener" class="work-info__link" :title="`Abrir en ${p.name}`">
              <img v-if="p.logo" :src="p.logo" alt="" class="work-info__logo" />
              {{ p.name }}
            </a>
          </li>
        </ul>
      </div>
      <p v-if="data.where.credit && data.where.groups.length" class="work-info__credit">{{ data.where.credit }}</p>
    </section>
  </div>
</template>

<style scoped>
.work-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.work-info__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.work-info__facts,
.work-info__people {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.work-info__label {
  font-weight: 700;
  color: var(--color-text);
}

.work-info__overview {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--color-text);
  white-space: pre-line;
}

.work-info__overview--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.work-info__more {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
}

.work-info__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}

.work-info__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text);
}

.work-info__region {
  font-weight: 500;
  color: var(--color-text-muted);
}

.work-info__cast {
  list-style: none;
  margin: 0;
  padding: 0 0 4px;
  display: flex;
  gap: var(--space-sm);
  overflow-x: auto;
}

.work-info__actor {
  width: 76px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}

.work-info__photo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--color-surface-2);
  margin-bottom: 4px;
}

.work-info__photo--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-subtle);
}

.work-info__actor-name {
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--color-text);
}

.work-info__character {
  font-size: 0.6875rem;
  line-height: 1.2;
  color: var(--color-text-muted);
}

.work-info__tracks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.work-info__track {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  padding: 4px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.8125rem;
}

.work-info__track:last-child {
  border-bottom: none;
}

.work-info__track-num {
  width: 1.5em;
  flex-shrink: 0;
  text-align: right;
  color: var(--color-text-subtle);
}

.work-info__track-name {
  flex: 1;
  min-width: 0;
  color: var(--color-text);
}

.work-info__track-time {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.work-info__providers {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  font-size: 0.8125rem;
}

.work-info__providers .work-info__label {
  min-width: 72px;
}

.work-info__links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.work-info__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-2);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 0.15s ease;
}

.work-info__link:hover {
  border-color: var(--color-accent);
}

.work-info__logo {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--color-surface);
}

.work-info__credit {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
}
</style>
