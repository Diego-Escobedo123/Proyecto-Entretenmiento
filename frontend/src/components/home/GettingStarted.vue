<script setup lang="ts">
/**
 * GettingStarted — "Primeros pasos" en Inicio para quien recién llega: 4
 * tareas que se van tachando solas (agregar una obra, ponerse una meta,
 * seguir a alguien, elegir sus favoritas). Así se descubre el diario, las
 * metas, lo social y el perfil. Desaparece al completarlas o con la ✕
 * (recordado por cuenta en este navegador).
 *
 * Uso: <GettingStarted />   (se oculta sola cuando no hace falta)
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import BaseIcon from '../BaseIcon.vue'
import ProgressBar from '../ProgressBar.vue'
import { useMediaStore } from '../../stores/media'
import { useProfileStore } from '../../stores/profile'
import { useAuthStore } from '../../stores/auth'
import { useUiStore } from '../../stores/ui'
import { goalService } from '../../services/goalService'
import { socialService } from '../../services/socialService'

const router = useRouter()
const ui = useUiStore()
const auth = useAuthStore()
const { entries } = storeToRefs(useMediaStore())
const { profile } = storeToRefs(useProfileStore())

// --- Cerrada con la ✕: por cuenta, en este navegador ---
const userId = computed(() => auth.user?.id ?? null)
const dismissKey = computed(() => `mosaic:getting-started-dismissed:${userId.value}`)
const dismissedNow = ref(false)
const dismissed = computed(() => {
  if (dismissedNow.value) return true
  try {
    return localStorage.getItem(dismissKey.value) === '1'
  } catch {
    return false
  }
})

function dismiss() {
  dismissedNow.value = true
  try {
    localStorage.setItem(dismissKey.value, '1')
  } catch {
    // Sin almacenamiento: se oculta igual, sólo hasta recargar.
  }
}

// --- Lo que no está en los stores: metas del año y a quién sigue ---
const hasGoal = ref(false)
const followsSomeone = ref(false)
const checked = ref(false)

// Espera a conocer a la persona (la sesión se revalida al arrancar).
watch(
  userId,
  async (id) => {
    if (!id || dismissed.value) return
    const [goals, following] = await Promise.allSettled([
      goalService.list(new Date().getFullYear()),
      socialService.following(id),
    ])
    hasGoal.value = goals.status === 'fulfilled' && goals.value.length > 0
    followsSomeone.value = following.status === 'fulfilled' && following.value.length > 0
    checked.value = true
  },
  { immediate: true },
)

const tasks = computed(() => [
  {
    key: 'work',
    icon: 'plus-circle',
    title: 'Agrega tu primera obra',
    text: 'Una película, serie, libro, juego o álbum que hayas disfrutado.',
    done: entries.value.length > 0,
    action: () => ui.openCreateEntry(),
  },
  {
    key: 'goal',
    icon: 'bullseye',
    title: 'Ponte una meta para este año',
    text: 'Por ejemplo, leer 12 libros o ver 50 películas.',
    done: hasGoal.value,
    action: () => void router.push('/diary?tab=review'),
  },
  {
    key: 'follow',
    icon: 'people',
    title: 'Sigue a alguien',
    text: 'Mira qué están viendo, leyendo y jugando tus amigos.',
    done: followsSomeone.value,
    action: () => void router.push('/people'),
  },
  {
    key: 'favorites',
    icon: 'heart',
    title: 'Elige tus favoritas',
    text: 'Las obras que te definen, al frente de tu perfil.',
    done: profile.value.topPicks.length > 0,
    action: () => void router.push('/profile'),
  },
])

const doneCount = computed(() => tasks.value.filter((t) => t.done).length)
const visible = computed(() => !dismissed.value && checked.value && doneCount.value < tasks.value.length)
</script>

<template>
  <Transition name="getting-started">
    <section v-if="visible" class="start" aria-labelledby="start-title">
      <header class="start__head">
        <div>
          <h2 id="start-title" class="start__title"><BaseIcon name="stars" /> Primeros pasos</h2>
          <p class="start__subtitle">{{ doneCount }} de {{ tasks.length }} · arma tu mosaico cultural</p>
        </div>
        <button type="button" class="start__close" aria-label="Ocultar primeros pasos" title="Ocultar" @click="dismiss">
          <BaseIcon name="x-lg" />
        </button>
      </header>

      <ProgressBar :percent="(doneCount / tasks.length) * 100" />

      <ol class="start__list">
        <li v-for="t in tasks" :key="t.key" class="start__task" :class="{ 'is-done': t.done }">
          <span class="start__check" aria-hidden="true">
            <BaseIcon :name="t.done ? 'check-circle-fill' : t.icon" />
          </span>
          <span class="start__text">
            <strong>{{ t.title }}</strong>
            <span>{{ t.text }}</span>
          </span>
          <span v-if="t.done" class="visually-hidden">Hecho</span>
          <button v-else type="button" class="start__go" :aria-label="t.title" @click="t.action">
            <BaseIcon name="arrow-right" />
          </button>
        </li>
      </ol>
    </section>
  </Transition>
</template>

<style scoped>
.start {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  border: 1px solid color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 100% 0%, var(--color-accent-bg), transparent 55%),
    var(--color-surface);
}

.start__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.start__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-text);
}

.start__title .bi {
  color: var(--color-accent);
}

.start__subtitle {
  margin-top: 2px;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.start__close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--color-text-subtle);
  cursor: pointer;
}

.start__close:hover {
  background: var(--color-accent-hover-bg);
  color: var(--color-text);
}

.start__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.start__task {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  transition: opacity var(--dur-base) ease;
}

.start__check {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-size: 1.125rem;
}

.start__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.start__text strong {
  font-size: 0.875rem;
  color: var(--color-text);
}

/* Hecha: check verde con pop, título tachado. */
.start__task.is-done {
  opacity: 0.7;
}

.start__task.is-done .start__check {
  background: color-mix(in srgb, var(--color-success) 18%, transparent);
  color: var(--color-success);
}

.start__task.is-done .start__check .bi {
  display: inline-block;
  animation: mosaic-pop var(--dur-base) var(--ease-spring);
}

.start__task.is-done .start__text strong {
  text-decoration: line-through;
  text-decoration-color: var(--color-text-subtle);
}

.start__go {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-out);
}

.start__go:hover {
  transform: translateX(2px);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.getting-started-enter-active,
.getting-started-leave-active {
  transition: opacity var(--dur-base) ease, transform var(--dur-base) var(--ease-out);
}

.getting-started-enter-from,
.getting-started-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
