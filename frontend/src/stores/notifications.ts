/**
 * Notificaciones (la campana de la barra superior). Se cargan al entrar a la
 * app y se vuelven a pedir cada minuto mientras la pestaña está abierta, así
 * el número se actualiza sin recargar.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { notificationService } from '../services/notificationService'
import type { AppNotification } from '../types/notification'

const REFRESH_MS = 60_000

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([])
  const unread = ref(0)
  const loaded = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  /** Vuelve a pedir la lista. Si falla, deja la anterior (no bloquea la app). */
  async function load(): Promise<void> {
    try {
      const page = await notificationService.list()
      items.value = page.items
      unread.value = page.unread
      loaded.value = true
    } catch {
      // Sin notificaciones a la vista: no pasa nada.
    }
  }

  /** Empieza a refrescar cada minuto (una sola vez aunque se llame varias). */
  function startPolling(): void {
    void load()
    if (timer) return
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
  }

  /** Al cerrar sesión: deja de pedir y vacía la campana. */
  function reset(): void {
    if (timer) clearInterval(timer)
    timer = null
    items.value = []
    unread.value = 0
    loaded.value = false
  }

  async function markRead(id: string): Promise<void> {
    const n = items.value.find((x) => x.id === id)
    if (!n || n.read) return
    n.read = true
    unread.value = Math.max(0, unread.value - 1)
    try {
      await notificationService.markRead(id)
    } catch {
      void load()
    }
  }

  async function markAllRead(): Promise<void> {
    if (!unread.value) return
    for (const n of items.value) n.read = true
    unread.value = 0
    try {
      await notificationService.markAllRead()
    } catch {
      void load()
    }
  }

  return { items, unread, loaded, load, startPolling, reset, markRead, markAllRead }
})