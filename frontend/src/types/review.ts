/**
 * Datos sociales: reseñas de otros usuarios sobre una obra y perfiles
 * públicos. Nunca incluyen notas privadas.
 */
import type { MediaStatus, MediaType } from './media'

/** Lo que otro usuario deja ver de sí mismo. */
export interface PublicUser {
  id: string
  name: string
  handle: string
  avatar: string | null
}

export interface WorkReview {
  id: string
  rating: number | null
  review: string
  updatedAt: string
  user: PublicUser
}

/** GET /reviews — opiniones de los demás sobre una obra. */
export interface WorkReviews {
  /** Promedio de calificaciones (0–5, un decimal); `null` si nadie calificó. */
  average: number | null
  ratingCount: number
  reviews: WorkReview[]
}

/** Identifica una obra entre usuarios: por id de catálogo o, si no hay, por tipo + título. */
export interface WorkKey {
  type: MediaType
  externalId: string | null
  title: string
}

/** Obra de otro usuario vista en su perfil público. */
export interface PublicEntry {
  id: string
  type: MediaType
  title: string
  creator: string
  status: MediaStatus
  year: number | null
  rating: number | null
  genres: string[]
  cover: string | null
  review: string
  /** Sólo presente si el dueño marcó sus notas como públicas. */
  notes: string | null
  updatedAt: string
}

/** GET /users/:id */
export interface PublicProfile {
  user: PublicUser
  tagline: string
  quote: string
  isPublic: boolean
  isSelf: boolean
  entries: PublicEntry[]
}
