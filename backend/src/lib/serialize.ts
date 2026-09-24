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
    review: row.review,
    notes: row.notes,
    notesPublic: row.notesPublic,
    cover: row.cover,
    externalId: row.externalId,
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
  'review',
  'notes',
  'notesPublic',
  'cover',
  'externalId',
] as const

export function fromMediaInput(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const key of WRITABLE) {
    if (!(key in body)) continue
    data[key] = key === 'genres' && !Array.isArray(body[key]) ? [] : body[key]
  }
  return data
}

/** Autor de una reseña o dueño de un perfil público: sólo datos visibles. */
export function toPublicUserDTO(user: {
  id: string
  name: string
  profile: { handle: string; avatar: string | null } | null
}) {
  return {
    id: user.id,
    name: user.name,
    handle: user.profile?.handle ?? '',
    avatar: user.profile?.avatar ?? null,
  }
}

/**
 * Obra vista por OTRO usuario (perfil público). Nunca incluye las notas
 * privadas: `notes` sólo viaja si el dueño las marcó como públicas.
 */
export function toPublicEntryDTO(row: MediaEntry) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    creator: row.creator,
    status: row.status,
    year: row.year,
    rating: row.rating,
    genres: row.genres,
    cover: row.cover,
    review: row.review,
    notes: row.notesPublic ? row.notes : null,
    updatedAt: row.updatedAt.toISOString(),
  }
}
