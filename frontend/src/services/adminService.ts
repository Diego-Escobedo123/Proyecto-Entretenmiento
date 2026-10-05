/** Panel de administración (`/admin`). El backend responde 403 si no eres ADMIN. */
import type { AdminStats, AdminUser, Role } from '../types/admin'
import { apiFetch } from '../lib/api'

export interface AdminService {
  stats(): Promise<AdminStats>
  /** Más recientes primero. `q` busca por nombre, correo o @usuario. */
  users(filters?: { q?: string; role?: Role }): Promise<AdminUser[]>
  setRole(userId: string, role: Role): Promise<AdminUser>
  deleteUser(userId: string): Promise<void>
}

class HttpAdminService implements AdminService {
  stats(): Promise<AdminStats> {
    return apiFetch<AdminStats>('/admin/stats')
  }

  users(filters: { q?: string; role?: Role } = {}): Promise<AdminUser[]> {
    const params = new URLSearchParams()
    if (filters.q?.trim()) params.set('q', filters.q.trim())
    if (filters.role) params.set('role', filters.role)
    const qs = params.toString()
    return apiFetch<AdminUser[]>(`/admin/users${qs ? `?${qs}` : ''}`)
  }

  setRole(userId: string, role: Role): Promise<AdminUser> {
    return apiFetch<AdminUser>(`/admin/users/${encodeURIComponent(userId)}/role`, { method: 'PATCH', body: { role } })
  }

  deleteUser(userId: string): Promise<void> {
    return apiFetch<void>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
  }
}

export const adminService: AdminService = new HttpAdminService()