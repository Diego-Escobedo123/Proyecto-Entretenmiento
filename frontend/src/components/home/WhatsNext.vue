<script setup lang="ts">
/**
 * WhatsNext — "¿Qué sigue?" en Inicio: 3 ideas de la wishlist para decidir
 * qué ver, leer, jugar o escuchar hoy. Arranca por las que llevan más tiempo
 * esperando; "Otra idea" baraja. Desde aquí se empieza directo (series,
 * libros, juegos pasan a "En curso") o se marca como vista/escuchada
 * (películas y álbumes, que no tienen avance). Sin wishlist, no aparece.
 *
 * Uso: <WhatsNext />
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseIcon from '../BaseIcon.vue'
import { coverOk, vCover } from '../../lib/cover'
import { typeMeta } from '../../lib/catalog'
import { todayISO } from '../../lib/dates'
import { useMediaStore } from '../../stores/media'
import { useToastStore } from '../../stores/toast'
import { useUiStore } from '../../stores/ui'
import type { MediaEntry, MediaType } from '../../types/media'

const media = useMediaStore()
const toast = useToastStore()
const ui = useUiStore()
const router = useRouter()

const PICKS = 3

/** La wishlist de la más antigua a la más nueva: primero lo que lleva más tiempo esperando. */
const oldestFirst = computed(() => [...media.wishlist].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))

/** Ids elegidos al barajar; null = las más antiguas. */
const shuffled = ref<string[] | null>(null)

const picks = computed<MediaEntry[]>(() => {
  if (!shuffled.value) return oldestFirst.value.slice(0, PICKS)
  const byId = new Map(media.wishlist.map((e) => [e.id, e]))
  const chosen = shuffled.value.map((id) => byId.get(id)).filter((e): e is MediaEntry => !!e)
  // Si alguna ya no está en la wishlist (se empezó), se completa con otras.
  const rest = oldestFirst.value.filter((e) => !shuffled.value!.includes(e.id))
  return [...chosen, ...rest].slice(0, PICKS)
})

/** Otras 3 al azar, sin repetir las que se ven ahora (si alcanza). */
function anotherIdea() {
  const current = new Set(picks.value.map((e) => e.id))
  const pool = media.wishlist.filter((e) => !current.has(e.id))
  const source = pool.length >= PICKS ? pool : media.wishlist
  shuffled.value = [...source]
    .sort(() => Math.random() - 0.5)
    .slice(0, PICKS)
    .map((e) => e.id)
}

const canShuffle = computed(() => media.wishlist.length > PICKS)

// --- Acciones ---

/** Películas y álbumes no tienen avance: se marcan directo como vistos/escuchados. */
const INSTANT: Partial<Record<MediaType, string>> = { movie: 'Ya la vi', music: 'Ya lo escuché' }

async function start(entry: MediaEntry) {
  const ok = await media.patchEntryOptimistic(
    entry.id,
    { status: 'in-progress' },
    { logDate: todayISO() },
    `No se pudo empezar «${entry.title}».`,
  )
  if (ok) toast.success(`Empezaste «${entry.title}». Ya está en Continuar.`)
}

async function markDone(entry: MediaEntry) {
  const ok = await media.patchEntryOptimistic(
    entry.id,
    { status: 'completed' },
    { logDate: todayISO() },
    `No se pudo guardar «${entry.title}».`,
  )
  if (ok) {
    toast.show(`¡Listo! «${entry.title}» ya está en tu diario.`, {
      tone: 'success',
      action: { label: 'Calificar', run: () => ui.openEditEntry(entry.id) },
      duration: 6000,
    })
  }
}

/** "En tu wishlist desde hace 3 meses". */
function waiting(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  if (days < 1) return 'La agregaste hoy'
  if (days < 30) return `Esperando hace ${days} ${days === 1 ? 'día' : 'días'}`
  const months = Math.floor(days / 30)
  if (months < 12) return `Esperando hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  return 'Esperando hace más de un año'
}
</script>

<template>
  <section v-if="picks.length" class="next" aria-labelledby="next-title">
    <header class="next__head">
      <div>
        <h2 id="next-title" class="next__title">¿Qué sigue?</h2>
        <p class="next__subtitle">Ideas de tu wishlist para hoy</p>
      </div>
      <div class="next__links">
        <button v-if="canShuffle" type="button" class="next__shuffle" @click="anotherIdea">
          <BaseIcon name="shuffle" /> Otra idea
        </button>
        <button type="button" class="next__link" @click="router.push('/lists/wishlist')">
          Ver wishlist <BaseIcon name="arrow-right" />
        </button>
      </div>
    </header>

    <TransitionGroup tag="ul" name="next-pick" class="next__list">
      <li v-for="(e, i) in picks" :key="e.id" class="next__pick" :style="{ '--i': i }">
        <button type="button" class="next__cover-btn" :aria-label="`Ver ficha de ${e.title}`" @click="ui.openWorkDetail(e)">
          <img v-if="coverOk(e.cover)" v-cover="e.cover" :src="e.cover" alt="" class="next__cover" loading="lazy" />
          <span v-else class="next__cover next__cover--empty" aria-hidden="true">
            <BaseIcon :name="typeMeta(e.type).icon" />
          </span>
        </button>

        <div class="next__info">
          <span class="next__type"><BaseIcon :name="typeMeta(e.type).icon" /> {{ typeMeta(e.type).label }}</span>
          <button type="button" class="next__name" @click="ui.openWorkDetail(e)">{{ e.title }}</button>
          <span class="next__waiting">{{ waiting(e.createdAt) }}</span>

          <button v-if="INSTANT[e.type]" type="button" class="next__go" @click="markDone(e)">
            <BaseIcon name="check2" /> {{ INSTANT[e.type] }}
          </button>
          <button v-else type="button" class="next__go" @click="start(e)">
            <BaseIcon name="play-fill" /> Empezar
          </button>
        </div>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.next__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
  margin-bottom: var(--space-md);
}

.next__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.next__subtitle {
  margin-top: 2px;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.next__links {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.next__shuffle,
.next__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--dur-fast) ease, color var(--dur-fast) ease;
}

.next__link {
  border-color: transparent;
}

.next__shuffle:hover,
.next__link:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* El ícono gira al barajar. */
.next__shuffle:active .bi {
  display: inline-block;
  transform: rotate(180deg);
  transition: transform var(--dur-base) var(--ease-spring);
}

.next__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.next__pick {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.next__cover-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.next__cover {
  display: block;
  width: 72px;
  height: 108px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface-2);
}

.next__cover--empty {
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  color: var(--color-text-subtle);
}

.next__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.next__type {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.next__name {
  max-width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text);
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.next__name:hover {
  color: var(--color-accent);
}

.next__waiting {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.next__go {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform var(--dur-fast) ease;
}

.next__go:active {
  transform: scale(0.95);
}

/* Al barajar: las nuevas entran escalonadas; las que salen se desvanecen. */
.next-pick-enter-active {
  transition: opacity 350ms var(--ease-out), transform 350ms var(--ease-out);
  transition-delay: calc(var(--i, 0) * 60ms);
}

.next-pick-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.next-pick-leave-active {
  display: none;
}
</style>
