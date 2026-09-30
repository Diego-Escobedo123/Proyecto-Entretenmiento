/** Listas de obras (backend `/lists`). */
import type { ListDetail, ListInput, ListItem, ListSummary, ListWork } from '../types/list'
import { apiFetch } from '../lib/api'

export const listService = {
  /** Mis listas. Con `work`, cada una trae `workItemId` (si esa obra ya está en ella). */
  mine(work?: Pick<ListWork, 'type' | 'title' | 'externalId'>): Promise<ListSummary[]> {
    if (!work) return apiFetch<ListSummary[]>('/lists')
    const params = new URLSearchParams({ type: work.type, title: work.title })
    if (work.externalId) params.set('externalId', work.externalId)
    return apiFetch<ListSummary[]>(`/lists?${params.toString()}`)
  },

  get(id: string): Promise<ListDetail> {
    return apiFetch<ListDetail>(`/lists/${id}`)
  },

  create(input: ListInput): Promise<ListSummary> {
    return apiFetch<ListSummary>('/lists', { method: 'POST', body: input })
  },

  update(id: string, patch: Partial<ListInput>): Promise<ListSummary> {
    return apiFetch<ListSummary>(`/lists/${id}`, { method: 'PATCH', body: patch })
  },

  remove(id: string): Promise<void> {
    return apiFetch<void>(`/lists/${id}`, { method: 'DELETE' })
  },

  addItem(listId: string, work: ListWork, note = ''): Promise<ListItem> {
    return apiFetch<ListItem>(`/lists/${listId}/items`, { method: 'POST', body: { ...work, note } })
  },

  updateNote(listId: string, itemId: string, note: string): Promise<ListItem> {
    return apiFetch<ListItem>(`/lists/${listId}/items/${itemId}`, { method: 'PATCH', body: { note } })
  },

  removeItem(listId: string, itemId: string): Promise<void> {
    return apiFetch<void>(`/lists/${listId}/items/${itemId}`, { method: 'DELETE' })
  },

  /** Guarda el orden completo de la lista. */
  reorder(listId: string, itemIds: string[]): Promise<void> {
    return apiFetch<void>(`/lists/${listId}/order`, { method: 'POST', body: { itemIds } })
  },
}
