import type { MediaType } from './media'

/** Roles de la plataforma (mismo enum `Role` del backend). */
export type Role = 'USER' | 'ADMIN'

/** Usuario tal como lo ve el panel de administración (GET /admin/users). */
export interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  handle: string
  avatar: string | null
  /** ISO 8601. */
  createdAt: string
  /** Obras registradas. */
  entries: number
  lists: number
}

/** Números generales (GET /admin/stats). */
export interface AdminStats {
  users: number
  admins: number
  /** Cuentas creadas en los últimos 7 días. */
  newUsers: number
  entries: number
  reviews: number
  lists: number
  /** Solicitudes de obras escritas a mano que esperan revisión. */
  pendingRequests: number
}

/** Solicitud para agregar una obra que no está en el catálogo (GET /admin/work-requests). */
export interface WorkRequest {
  id: string
  type: MediaType
  title: string
  creator: string
  year: number | null
  genres: string[]
  status: 'pending' | 'approved' | 'rejected'
  /** ISO 8601. */
  createdAt: string
  reviewedAt: string | null
  /** Quién la pidió (solo en las respuestas de /admin). */
  user?: { id: string; name: string; email: string; handle: string; avatar: string | null }
}