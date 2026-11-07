/**
 * Solicitudes para agregar obras que no están en el catálogo (backend `/work-requests`).
 * Un usuario normal no puede agregar una obra escrita a mano directo a su
 * colección: la manda como solicitud y un admin la revisa en /admin.
 */
import type { MediaEntryInput } from '../types/media'
import type { WorkRequest } from '../types/admin'
import type { MediaWriteOptions } from './mediaService'
import { apiFetch } from '../lib/api'

export const workRequestService = {
  create(input: MediaEntryInput, options?: MediaWriteOptions): Promise<WorkRequest> {
    return apiFetch<WorkRequest>('/work-requests', { method: 'POST', body: { ...input, ...options } })
  },
}