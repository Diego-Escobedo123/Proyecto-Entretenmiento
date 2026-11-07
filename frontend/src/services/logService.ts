/** Diario de visionados/lecturas (backend `/logs`). */
import type { LogEntry, LogInput } from '../types/log'
import { apiFetch } from '../lib/api'

export const logService = {
  /** Todo el diario, o sólo el de una obra. Más reciente primero. */
  list(entryId?: string): Promise<LogEntry[]> {
    const qs = entryId ? `?${new URLSearchParams({ entryId }).toString()}` : ''
    return apiFetch<LogEntry[]>(`/logs${qs}`)
  },

  /** Registrar otra vez una obra ("volver a verla"). */
  create(entryId: string, input: LogInput): Promise<LogEntry> {
    return apiFetch<LogEntry>('/logs', { method: 'POST', body: { entryId, ...input } })
  },

  update(id: string, patch: LogInput): Promise<LogEntry> {
    return apiFetch<LogEntry>(`/logs/${id}`, { method: 'PATCH', body: patch })
  },

  remove(id: string): Promise<void> {
    return apiFetch<void>(`/logs/${id}`, { method: 'DELETE' })
  },
}
