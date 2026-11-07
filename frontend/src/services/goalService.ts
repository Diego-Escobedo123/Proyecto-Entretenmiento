/** Reto anual (backend `/goals`). */
import type { Goal } from '../types/goal'
import { apiFetch } from '../lib/api'

export const goalService = {
  list(year: number): Promise<Goal[]> {
    return apiFetch<Goal[]>(`/goals?year=${year}`)
  },

  /** Crea o cambia la meta de ese año y tipo. */
  save(goal: Omit<Goal, 'id'>): Promise<Goal> {
    return apiFetch<Goal>('/goals', { method: 'POST', body: goal })
  },

  remove(id: string): Promise<void> {
    return apiFetch<void>(`/goals/${id}`, { method: 'DELETE' })
  },
}
