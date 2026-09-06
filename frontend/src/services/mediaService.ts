/**
 * Capa de acceso a datos de obras.
 *
 * Los componentes y stores hablan SÓLO con la interfaz `MediaService`, nunca con
 * localStorage ni con fetch directamente. Hoy la implementación es local; cuando
 * exista el backend basta con crear un `HttpMediaService` que implemente la misma
 * interfaz y cambiar la línea del export de abajo.
 */
import type { MediaEntry, MediaEntryInput } from '../types/media'
import { delay, makeId, readJson, writeJson } from './storage'

export interface MediaService {
  list(): Promise<MediaEntry[]>
  get(id: string): Promise<MediaEntry | null>
  create(input: MediaEntryInput): Promise<MediaEntry>
  update(id: string, patch: Partial<MediaEntryInput>): Promise<MediaEntry>
  remove(id: string): Promise<void>
}

const STORAGE_KEY = 'mosaic.entries.v1'

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

export const mediaService: MediaService = new LocalMediaService()
