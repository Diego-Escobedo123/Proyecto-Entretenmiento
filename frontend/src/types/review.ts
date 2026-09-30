/**
 * Datos sociales: reseñas de otros usuarios sobre una obra y perfiles
 * públicos. Nunca incluyen notas privadas.
 */
import type { MediaStatus, MediaType } from './media'
import type { ListSummary } from './list'
import type { LogEntry } from './log'

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

/** GET /reviews/stats — números de la obra en todo Mosaic (incluido el usuario actual). */
export interface WorkStats {
  /** Personas que la tienen en su colección. */
  people: number
  byStatus: { want: number; inProgress: number; finished: number; abandoned: number }
  rating: {
    average: number | null
    count: number
    /** 10 barras: [0] = ½ estrella … [9] = 5 estrellas. */
    histogram: number[]
  }
  /** Veces que se terminó (según los diarios) y cuántas de ellas fueron repeticiones. */
  finishes: number
  repeats: number
  /** Quiénes de los que sigue el usuario la tienen (sólo perfiles públicos). */
  following: { user: PublicUser; status: MediaStatus; rating: number | null }[]
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
  /** Id de catálogo, para abrir la ficha de la obra. */
  externalId: string | null
  review: string
  /** Sólo presente si el dueño marcó sus notas como públicas. */
  notes: string | null
  updatedAt: string
}

/** GET /users/:id */
export interface PublicProfile {
  user: PublicUser
  /** Vacíos si la persona no los escribió. */
  tagline: string
  quote: string
  memberSince: number | null
  isPublic: boolean
  isSelf: boolean
  /** El usuario actual lo sigue. */
  isFollowing: boolean
  followers: number
  following: number
  /** Con perfil privado (y si no es el propio), `works` y `finishedThisYear` vienen en 0. */
  counts: { works: number; finishedThisYear: number; lists: number }
  /** Sus 5 favoritas, en el orden que eligió. */
  favorites: PublicEntry[]
  /** Sus últimas entradas del diario (con los datos de la obra). */
  recent: LogEntry[]
  /** Cómo califica: promedio e histograma de ½ a 5. */
  ratings: { average: number | null; count: number; histogram: number[] }
  /** ADN cultural (vacío con perfil privado ajeno). */
  dna: {
    topGenres: { name: string; count: number; percent: number }[]
    favoriteDecade: { decade: number; percent: number } | null
    dominantType: MediaType | null
    completionRate: number
  }
  /** Días del último año en que empezó o terminó algo (Constancia). */
  activity: string[]
  entries: PublicEntry[]
  /** Sus listas públicas (visibles aunque el perfil sea privado). */
  lists: ListSummary[]
}
