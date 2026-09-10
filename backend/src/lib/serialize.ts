import type { MediaEntry } from '@prisma/client'

/**
 * Convierte una fila de Prisma al shape que espera el frontend
 * (`frontend/src/types/media.ts`): fechas como string ISO.
 */
export function toMediaDTO(row: MediaEntry) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    creator: row.creator,
    status: row.status,
    year: row.year,
    rating: row.rating,
    progress: row.progress,
    favorite: row.favorite,
    genres: row.genres,
    notes: row.notes,
    cover: row.cover,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Campos que el cliente puede escribir (MediaEntryInput). El resto se ignora. */
const WRITABLE = [
  'type',
  'title',
  'creator',
  'status',
  'year',
  'rating',
  'progress',
  'favorite',
  'genres',
  'notes',
  'cover',
] as const

export function fromMediaInput(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const key of WRITABLE) {
    if (!(key in body)) continue
    data[key] = key === 'genres' && !Array.isArray(body[key]) ? [] : body[key]
  }
  return data
}
