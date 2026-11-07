import type { MediaType } from './media'

/** Qué pasó. Ver `backend/src/lib/notifications.ts`. */
export type NotificationType =
  | 'follow'
  | 'follow_request'
  | 'follow_accepted'
  | 'goal_completed'
  | 'work_approved'
  | 'work_rejected'

/** Una notificación tal como la devuelve GET /notifications. */
export interface AppNotification {
  id: string
  type: NotificationType
  read: boolean
  /** ISO 8601. */
  createdAt: string
  /** Quién la provocó; null en las de metas. */
  actor: { id: string; name: string; handle: string; avatar: string | null } | null
  /** Metas: año, tipo y objetivo cumplido. Solicitudes de obras: título y tipo de la obra. */
  data: { year?: number; type?: MediaType | 'all'; target?: number; title?: string } | null
}

export interface NotificationPage {
  items: AppNotification[]
  /** Sin leer en total (puede ser más que las que vienen en `items`). */
  unread: number
}