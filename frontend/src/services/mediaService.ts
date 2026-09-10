/**
 * Capa de acceso a datos de obras.
 *
 * Los componentes y stores hablan SÓLO con la interfaz `MediaService`, nunca con
 * `fetch` ni con localStorage directamente. La implementación activa es
 * `HttpMediaService` (backend real); `LocalMediaService` queda como referencia y
 * fallback offline. Para cambiar, se toca sólo la línea del `export` de abajo.
 */
import type { MediaEntry, MediaEntryInput } from '../types/media'
import { apiFetch, ApiError } from '../lib/api'
import { delay, makeId, readJson, writeJson } from './storage'

export interface MediaService {
  list(): Promise<MediaEntry[]>
  get(id: string): Promise<MediaEntry | null>
  create(input: MediaEntryInput): Promise<MediaEntry>
  update(id: string, patch: Partial<MediaEntryInput>): Promise<MediaEntry>
  remove(id: string): Promise<void>
}

/** Implementación HTTP contra el backend (`/media`). */
class HttpMediaService implements MediaService {
  list(): Promise<MediaEntry[]> {
    return apiFetch<MediaEntry[]>('/media')
  }

  async get(id: string): Promise<MediaEntry | null> {
    try {
      return await apiFetch<MediaEntry>(`/media/${id}`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  }

  create(input: MediaEntryInput): Promise<MediaEntry> {
    return apiFetch<MediaEntry>('/media', { method: 'POST', body: input })
  }

  update(id: string, patch: Partial<MediaEntryInput>): Promise<MediaEntry> {
    return apiFetch<MediaEntry>(`/media/${id}`, { method: 'PATCH', body: patch })
  }

  remove(id: string): Promise<void> {
    return apiFetch<void>(`/media/${id}`, { method: 'DELETE' })
  }
}

const STORAGE_KEY = 'mosaic.entries.v1'

/** Implementación local sobre localStorage. Sin backend. */
class LocalMediaService implements MediaService {
  private load(): MediaEntry[] {
    return readJson<MediaEntry[]>(STORAGE_KEY, [])
  }

  private save(entries: MediaEntry[]): void {
    writeJson(STORAGE_KEY, entries)
  }

  async list(): Promise<MediaEntry[]> {
    await delay()
    return this.load().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(id: string): Promise<MediaEntry | null> {
    await delay(80)
    return this.load().find((e) => e.id === id) ?? null
  }

  async create(input: MediaEntryInput): Promise<MediaEntry> {
    await delay()
    const now = new Date().toISOString()
    const entry: MediaEntry = { ...input, id: makeId(), createdAt: now, updatedAt: now }
    const entries = this.load()
    entries.push(entry)
    this.save(entries)
    return entry
  }

  async update(id: string, patch: Partial<MediaEntryInput>): Promise<MediaEntry> {
    await delay()
    const entries = this.load()
    const index = entries.findIndex((e) => e.id === id)
    if (index === -1) throw new Error(`No existe la obra ${id}`)
    const updated: MediaEntry = {
      ...entries[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    entries[index] = updated
    this.save(entries)
    return updated
  }

  async remove(id: string): Promise<void> {
    await delay()
    this.save(this.load().filter((e) => e.id !== id))
  }
}

export const mediaService: MediaService = new HttpMediaService()

export { HttpMediaService, LocalMediaService }
