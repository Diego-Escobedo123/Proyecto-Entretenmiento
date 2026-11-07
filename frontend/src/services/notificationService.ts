/** Notificaciones del usuario actual (backend `/notifications`). */
import type { NotificationPage } from '../types/notification'
import { apiFetch } from '../lib/api'

export const notificationService = {
  list(): Promise<NotificationPage> {
    return apiFetch<NotificationPage>('/notifications')
  },

  markRead(id: string): Promise<void> {
    return apiFetch<void>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })
  },

  markAllRead(): Promise<void> {
    return apiFetch<void>('/notifications/read-all', { method: 'POST' })
  },
}