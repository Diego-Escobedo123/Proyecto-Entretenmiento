import type { MediaEntry } from '@prisma/client'
import { upgradeBookCover } from './externalSearch'

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
    pagesRead: row.pagesRead,
    pagesTotal: row.pagesTotal,
    season: row.season,
    episode: row.episode,
    hoursPlayed: row.hoursPlayed,
    platform: row.platform,
    favorite: row.favorite,
    genres: row.genres,
    review: row.review,
    notes: row.notes,
    notesPublic: row.notesPublic,
    cover: upgradeBookCover(row.cover),
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
  'pagesRead',
  'pagesTotal',
  'season',
  'episode',
  'hoursPlayed',
  'platform',
  'favorite',
  'genres',
  'review',
  'notes',
  'notesPublic',
  'cover',
  'externalId',
] as const

/** Campos numéricos opcionales: cualquier valor que no sea un número >= 0 se guarda como null. */
const INT_FIELDS = new Set(['progress', 'pagesRead', 'pagesTotal', 'season', 'episode'])
const FLOAT_FIELDS = new Set(['rating', 'hoursPlayed'])

const STATUSES = new Set(['want', 'in-progress', 'completed', 'mastered', 'abandoned'])

export function fromMediaInput(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const key of WRITABLE) {
    if (!(key in body)) continue
    const value = body[key]
    if (key === 'genres') data[key] = Array.isArray(value) ? value : []
    else if (INT_FIELDS.has(key) || FLOAT_FIELDS.has(key)) {
      const n = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
      data[key] = n != null && INT_FIELDS.has(key) ? Math.round(n) : n
    } else if (key === 'status') data[key] = typeof value === 'string' && STATUSES.has(value) ? value : 'want'
    else if (key === 'platform') data[key] = typeof value === 'string' && value.trim() ? value.trim() : null
    else data[key] = value
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
    cover: upgradeBookCover(row.cover),
    externalId: row.externalId,
    review: row.review,
    notes: row.notesPublic ? row.notes : null,
    updatedAt: row.updatedAt.toISOString(),
  }
}
