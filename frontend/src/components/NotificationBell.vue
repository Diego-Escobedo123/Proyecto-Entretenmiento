<script setup lang="ts">
/**
 * NotificationBell — campana de la barra superior. Muestra cuántas
 * notificaciones hay sin leer y, al abrirla, la lista de las más recientes:
 * quién te siguió, quién pidió seguirte, quién aceptó tu solicitud, las
 * metas anuales cumplidas y si un admin aprobó o rechazó una obra que
 * pediste agregar. Al hacer clic en una se marca como leída y lleva a donde
 * corresponde (el perfil de esa persona, Personas, el Diario o tu colección).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseIcon from './BaseIcon.vue'
import UserAvatar from './social/UserAvatar.vue'
import { useNotificationsStore } from '../stores/notifications'
import { relativeTime } from '../lib/dates'
import { typeMeta } from '../lib/catalog'
import type { AppNotification } from '../types/notification'

const router = useRouter()
const notifications = useNotificationsStore()

const open = ref(false)
const wrapEl = ref<HTMLElement | null>(null)

const badge = computed(() => (notifications.unread > 9 ? '9+' : String(notifications.unread)))

function toggle() {
  open.value = !open.value
  // Al abrirla, trae lo más nuevo.
  if (open.value) void notifications.load()
}

/** Texto de cada notificación (sin el nombre, que va en negrita aparte). */
function message(n: AppNotification): string {
  switch (n.type) {
    case 'follow':
      return 'empezó a seguirte.'
    case 'follow_request':
      return 'quiere seguirte.'
    case 'follow_accepted':
      return 'aceptó tu solicitud. Ya puedes ver su perfil.'
    case 'goal_completed': {
      const { year, type, target } = n.data ?? {}
      const one = target === 1
      const what =
        !type || type === 'all'
          ? one ? 'obra' : 'obras'
          : (one ? typeMeta(type).label : typeMeta(type).plural).toLowerCase()
      return `¡Cumpliste tu meta de ${year}: ${target} ${what}!`
    }
    case 'work_approved':
      return `Se aprobó «${n.data?.title ?? ''}». Ya está en tu colección.`
    case 'work_rejected':
      return `Un administrador rechazó «${n.data?.title ?? ''}», así que no se agregó a tu colección.`
  }
}

function icon(n: AppNotification): string {
  if (n.type === 'goal_completed') return 'trophy'
  if (n.type === 'work_approved') return 'check-circle'
  if (n.type === 'work_rejected') return 'x-circle'
  if (n.type === 'follow_request') return 'person-plus'
  if (n.type === 'follow_accepted') return 'person-check'
  return 'person-heart'
}

/** A dónde lleva cada una. */
function target(n: AppNotification): string {
  if (n.type === 'goal_completed') return '/diary'
  if (n.type === 'follow_request') return '/people'
  if (n.type === 'work_approved') return '/collection'
  if (n.type === 'work_rejected') return '/'
  return n.actor ? `/users/${n.actor.id}` : '/'
}

function select(n: AppNotification) {
  void notifications.markRead(n.id)
  open.value = false
  void router.push(target(n))
}

function onDocClick(event: MouseEvent) {
  if (open.value && wrapEl.value && !wrapEl.value.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="wrapEl" class="bell">
    <button
      type="button"
      class="bell__button"
      :aria-label="notifications.unread ? `Notificaciones, ${notifications.unread} sin leer` : 'Notificaciones'"
      :aria-expanded="open"
      @click="toggle"
    >
      <BaseIcon :name="notifications.unread ? 'bell-fill' : 'bell'" />
      <span v-if="notifications.unread" class="bell__badge" aria-hidden="true">{{ badge }}</span>
    </button>

    <Transition name="bell-panel">
      <div v-if="open" class="bell__panel" role="dialog" aria-label="Notificaciones">
        <header class="bell__head">
          <h2 class="bell__title">Notificaciones</h2>
          <button v-if="notifications.unread" type="button" class="bell__read-all" @click="notifications.markAllRead()">
            Marcar todas como leídas
          </button>
        </header>

        <p v-if="!notifications.items.length" class="bell__empty">
          <BaseIcon name="bell-slash" />
          Todavía no tienes notificaciones.
        </p>

        <ul v-else class="bell__list">
          <li v-for="n in notifications.items" :key="n.id">
            <button
              type="button"
              class="bell__item"
              :class="{ 'bell__item--unread': !n.read }"
              @click="select(n)"
            >
              <UserAvatar v-if="n.actor" :user="n.actor" :size="36" :link="false" />
              <span v-else class="bell__icon" aria-hidden="true"><BaseIcon :name="icon(n)" /></span>

              <span class="bell__text">
                <span>
                  <strong v-if="n.actor">{{ n.actor.name }}</strong>
                  {{ message(n) }}
                </span>
                <span class="bell__time">{{ relativeTime(n.createdAt) }}</span>
              </span>

              <span v-if="!n.read" class="bell__dot" aria-label="Sin leer" />
            </button>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bell {
  position: relative;
}

.bell__button {
  position: relative;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--color-text-muted);
  font-size: 1.125rem;
  cursor: pointer;
}

.bell__button:hover,
.bell__button[aria-expanded='true'] {
  background: var(--color-accent-hover-bg);
  color: var(--color-accent);
}

.bell__badge {
  position: absolute;
  top: 0;
  right: -2px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-size: 0.6875rem;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
}

.bell__panel {
  position: absolute;
  top: calc(100% + var(--space-xs));
  right: 0;
  z-index: 50;
  width: min(380px, calc(100vw - 32px));
  max-height: min(480px, calc(100vh - 100px));
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.bell__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.bell__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
}

.bell__read-all {
  border: none;
  background: none;
  color: var(--color-link);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.bell__read-all:hover {
  color: var(--color-link-hover);
}

.bell__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  padding: var(--space-xl) var(--space-md);
  color: var(--color-text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.bell__empty :deep(i) {
  font-size: 1.5rem;
}

.bell__list {
  margin: 0;
  padding: var(--space-xs) 0;
  list-style: none;
  overflow-y: auto;
}

.bell__item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: none;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
}

.bell__item:hover {
  background: var(--color-accent-hover-bg);
}

.bell__item--unread {
  color: var(--color-text);
}

.bell__item strong {
  color: var(--color-text);
}

.bell__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.bell__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}

.bell__time {
  color: var(--color-text-subtle);
  font-size: 0.75rem;
}

.bell__dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-accent);
}

.bell-panel-enter-active,
.bell-panel-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.bell-panel-enter-from,
.bell-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>