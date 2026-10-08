/** Panel de administración (`/admin`). El backend responde 403 si no eres ADMIN. */
import type { AdminStats, AdminUser, Role, WorkRequest } from '../types/admin'
import { apiFetch } from '../lib/api'

export interface AdminService {
  stats(): Promise<AdminStats>
  /** Más recientes primero. `q` busca por nombre, correo o @usuario. */
  users(filters?: { q?: string; role?: Role }): Promise<AdminUser[]>
  setRole(userId: string, role: Role): Promise<AdminUser>
  deleteUser(userId: string): Promise<void>
  /** Solicitudes de obras escritas a mano que esperan revisión, las más antiguas primero. */
  workRequests(): Promise<WorkRequest[]>
  /** Aprueba la solicitud: la obra se agrega a la colección de quien la pidió. */
  approveWorkRequest(id: string): Promise<WorkRequest>
  rejectWorkRequest(id: string): Promise<WorkRequest>
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

  workRequests(): Promise<WorkRequest[]> {
    return apiFetch<WorkRequest[]>('/admin/work-requests')
  }

  approveWorkRequest(id: string): Promise<WorkRequest> {
    return apiFetch<WorkRequest>(`/admin/work-requests/${encodeURIComponent(id)}/approve`, { method: 'POST' })
  }

  rejectWorkRequest(id: string): Promise<WorkRequest> {
    return apiFetch<WorkRequest>(`/admin/work-requests/${encodeURIComponent(id)}/reject`, { method: 'POST' })
  }
}

export const adminService: AdminService = new HttpAdminService()