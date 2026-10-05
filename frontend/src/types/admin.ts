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
}