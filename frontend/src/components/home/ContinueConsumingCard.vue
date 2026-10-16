<script setup lang="ts">
/**
 * ContinueConsumingCard — obra en progreso para retomar desde Inicio: su
 * avance propio ("p. 180 de 495", "T3 · E5", "12 h · PS5") y atajos para
 * anotarlo sin abrir el formulario: "+1 episodio" (pasa de temporada solo),
 * la página en la que vas, "+1 h" y "La terminé". Al llegar al último
 * episodio o página pregunta si ya la terminó. El lápiz abre el formulario
 * completo; clic en la portada o el título, la ficha.
 *
 * Uso:
 *   <ContinueConsumingCard :entry="entry" @open="…" @update="…" />
 */
import { coverOk, vCover } from '../../lib/cover'
import { computed, nextTick, ref } from 'vue'
import BaseBadge from '../BaseBadge.vue'
import BaseIcon from '../BaseIcon.vue'
import ProgressBar from '../ProgressBar.vue'
import { statusLabel, typeMeta } from '../../lib/catalog'
import { bookProgress, nextEpisode, progressSummary, reachedEnd, seriesProgress } from '../../lib/progress'
import { todayISO } from '../../lib/dates'
import { seriesSeasons } from '../../services/detailsService'
import { useMediaStore } from '../../stores/media'
import { useToastStore } from '../../stores/toast'
import { useUiStore } from '../../stores/ui'
import type { MediaEntry, MediaEntryInput } from '../../types/media'

const props = defineProps<{ entry: MediaEntry }>()
defineEmits<{ open: []; update: [] }>()

const media = useMediaStore()
const toast = useToastStore()
const ui = useUiStore()

const summary = computed(() => progressSummary(props.entry))
const progressText = computed(() => {
  const parts = [summary.value, props.entry.progress != null ? `${props.entry.progress}%` : null]
  return parts.filter(Boolean).join(' · ') || statusLabel(props.entry.type, props.entry.status)
})

/** "La terminé" / "Lo terminé", según el género de la palabra (película, libro…). */
const pronoun = computed(() => (typeMeta(props.entry.type).gender === 'f' ? 'la' : 'lo'))
const busy = ref(false)

/** Guarda un avance y ofrece deshacerlo desde el aviso. */
async function saveProgress(patch: Partial<MediaEntryInput>, message: string) {
  const e = props.entry
  const previous = { season: e.season, episode: e.episode, pagesRead: e.pagesRead, hoursPlayed: e.hoursPlayed, progress: e.progress }
  busy.value = true
  const ok = await media.patchEntryOptimistic(e.id, patch)
  busy.value = false
  if (!ok) return
  toast.show(message, {
    action: { label: 'Deshacer', run: () => void media.patchEntryOptimistic(e.id, previous) },
  })
  // Llegó al último episodio o página: ¿la terminó?
  const updated = media.getById(e.id)
  if (updated && reachedEnd(updated, await seriesSeasons(updated.externalId))) {
    endReached.value = true
    confirmingFinish.value = true
  }
}

// --- Series: +1 episodio (con las temporadas de la ficha, si se conocen) ---
async function plusEpisode() {
  if (busy.value) return
  const e = props.entry
  const seasons = await seriesSeasons(e.externalId)
  const next = nextEpisode(seasons, e.season, e.episode)
  if (next.last) {
    endReached.value = true
    confirmingFinish.value = true
    return
  }
  await saveProgress(
    {
      season: next.season,
      episode: next.episode,
      progress: seriesProgress(seasons, next.season, next.episode) ?? e.progress,
    },
    `«${e.title}»: T${next.season} · E${next.episode}`,
  )
}

// --- Libros: "Voy en la página…" ---
const editingPage = ref(false)
const pageDraft = ref<number | null>(null)
const pageInput = ref<HTMLInputElement | null>(null)

async function startPage() {
  pageDraft.value = props.entry.pagesRead ?? null
  editingPage.value = true
  await nextTick()
  pageInput.value?.select()
}

async function savePage() {
  // Enter y el blur de después llegan los dos: sólo cuenta el primero (Esc ya lo cerró sin guardar).
  if (!editingPage.value) return
  const e = props.entry
  const page = pageDraft.value
  editingPage.value = false
  if (page == null || !Number.isFinite(page) || page === e.pagesRead) return
  const pagesRead = Math.max(0, Math.min(Math.round(page), e.pagesTotal ?? Infinity))
  await saveProgress(
    { pagesRead, progress: bookProgress(pagesRead, e.pagesTotal) ?? e.progress },
    `«${e.title}»: página ${pagesRead}`,
  )
}

// --- Juegos: +1 hora ---
async function plusHour() {
  if (busy.value) return
  const hoursPlayed = (props.entry.hoursPlayed ?? 0) + 1
  await saveProgress({ hoursPlayed }, `«${props.entry.title}»: ${hoursPlayed.toLocaleString('es')} h jugadas`)
}

// --- La terminé (con confirmación: crea la entrada del diario) ---
const confirmingFinish = ref(false)
/** Se preguntó porque llegó al final (no porque tocó "La terminé"). */
const endReached = ref(false)

function cancelFinish() {
  confirmingFinish.value = false
  endReached.value = false
}

async function finish() {
  const e = props.entry
  confirmingFinish.value = false
  busy.value = true
  const ok = await media.patchEntryOptimistic(
    e.id,
    // Un libro terminado se da por leído completo (como en el formulario).
    { status: 'completed', ...(e.type === 'book' && e.pagesTotal ? { pagesRead: e.pagesTotal } : {}) },
    { logDate: todayISO() },
    `No se pudo marcar «${e.title}» como terminada.`,
  )
  busy.value = false
  if (ok) {
    toast.show(`¡Terminaste «${e.title}»! Ya está en tu diario.`, {
      tone: 'success',
      action: { label: 'Calificar', run: () => ui.openEditEntry(e.id) },
      duration: 6000,
    })
  }
}
</script>

<template>
  <div class="continue-card">
    <button type="button" class="continue-card__cover-btn" :aria-label="`Ver ficha de ${entry.title}`" @click="$emit('open')">
      <img v-if="coverOk(entry.cover)" v-cover="entry.cover" class="continue-card__cover" :src="entry.cover" alt="" />
      <span v-else class="continue-card__cover continue-card__cover--empty" aria-hidden="true">
        <BaseIcon :name="typeMeta(entry.type).icon" />
      </span>
    </button>

    <div class="continue-card__body">
      <div class="continue-card__meta">
        <BaseBadge>{{ typeMeta(entry.type).label }}</BaseBadge>
        <span class="continue-card__progress-label">{{ progressText }}</span>
      </div>

      <button type="button" class="continue-card__title" @click="$emit('open')">{{ entry.title }}</button>
      <p v-if="entry.creator" class="continue-card__author">{{ entry.creator }}</p>

      <ProgressBar v-if="entry.progress != null" :percent="entry.progress" />

      <!-- ¿La terminó? (al tocar "La terminé" o al llegar al final) -->
      <div v-if="confirmingFinish" class="continue-card__confirm" role="group" aria-label="Confirmar">
        <span>{{ endReached ? 'Llegaste al final. ' : '' }}¿Ya {{ pronoun }} terminaste?</span>
        <button type="button" class="quick quick--primary" @click="finish">Sí</button>
        <button type="button" class="quick" @click="cancelFinish">Todavía no</button>
      </div>

      <!-- Atajos de avance según el tipo -->
      <div v-else class="continue-card__actions">
        <button v-if="entry.type === 'series'" type="button" class="quick" :disabled="busy" @click="plusEpisode">
          <BaseIcon name="plus-lg" /> 1 episodio
        </button>

        <template v-else-if="entry.type === 'book'">
          <form v-if="editingPage" class="continue-card__page" @submit.prevent="savePage">
            <label :for="`page-${entry.id}`">Página</label>
            <input
              :id="`page-${entry.id}`"
              ref="pageInput"
              v-model.number="pageDraft"
              type="number"
              min="0"
              :max="entry.pagesTotal ?? undefined"
              inputmode="numeric"
              class="continue-card__page-input"
              @keydown.esc="editingPage = false"
              @blur="savePage"
            />
            <span v-if="entry.pagesTotal" class="continue-card__page-total">de {{ entry.pagesTotal }}</span>
          </form>
          <button v-else type="button" class="quick" :disabled="busy" @click="startPage">
            <BaseIcon name="bookmark" /> Voy en la página…
          </button>
        </template>

        <button v-else-if="entry.type === 'game'" type="button" class="quick" :disabled="busy" @click="plusHour">
          <BaseIcon name="plus-lg" /> 1 hora
        </button>

        <button type="button" class="quick" :disabled="busy" @click="confirmingFinish = true">
          <BaseIcon name="check2" /> {{ pronoun === 'la' ? 'La' : 'Lo' }} terminé
        </button>
      </div>
    </div>

    <button
      class="continue-card__resume"
      type="button"
      :aria-label="`Actualizar avance de ${entry.title}`"
      title="Actualizar avance"
      @click="$emit('update')"
    >
      <BaseIcon name="pencil" />
    </button>
  </div>
</template>

<style scoped>
.continue-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.continue-card__cover-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.continue-card__cover {
  display: block;
  width: 64px;
  height: 96px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
}

.continue-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-subtle);
}

.continue-card__body {
  flex: 1;
  min-width: 0;
}

.continue-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
  flex-wrap: wrap;
}

.continue-card__progress-label {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

.continue-card__title {
  display: block;
  max-width: 100%;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
  text-align: left;
  margin: 0 0 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.continue-card__title:hover {
  color: var(--color-accent);
}

.continue-card__author {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 var(--space-sm) 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.continue-card__resume {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  border: none;
  background: var(--color-surface-2);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.continue-card__resume:hover,
.continue-card__resume:active {
  background: var(--color-accent-hover-bg);
  color: var(--color-accent-hover-contrast);
}

/* --- Atajos de avance --- */

.continue-card__actions,
.continue-card__confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}

.continue-card__confirm {
  font-size: 0.8125rem;
  color: var(--color-text);
  animation: mosaic-fade-up var(--dur-base) var(--ease-out);
}

.continue-card__confirm > span {
  margin-right: var(--space-xs);
}

.quick {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-2);
  color: var(--color-text);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color var(--dur-fast) ease,
    color var(--dur-fast) ease,
    transform var(--dur-fast) ease;
}

.quick:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.quick:active:not(:disabled) {
  transform: scale(0.95);
}

.quick:disabled {
  opacity: 0.6;
  cursor: default;
}

.quick--primary {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.quick--primary:hover:not(:disabled) {
  color: var(--color-accent-contrast);
}

.continue-card__page {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.continue-card__page-input {
  width: 64px;
  padding: 4px 8px;
  border: 1px solid var(--color-accent);
  border-radius: 999px;
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
  outline: none;
}

.continue-card__page-total {
  font-weight: 600;
}
</style>
