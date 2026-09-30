/** Seguir personas y el feed de actividad (backend `/users` y `/feed`). */
import type { ListSummary } from './list'
import type { MediaEntry } from './media'
import type { PublicUser } from './review'

/** Una persona en listas de seguidores, búsqueda o sugerencias. */
export interface Person extends PublicUser {
  /** El usuario actual ya la sigue. */
  isFollowing: boolean
  isSelf: boolean
}

export interface SuggestedPerson extends Person {
  /** Obras en común con el usuario actual, y hasta 3 títulos de ejemplo. */
  shared: number
  sharedTitles: string[]
}

type FeedWork = Pick<MediaEntry, 'type' | 'title' | 'creator' | 'year' | 'cover' | 'genres' | 'externalId'>

interface FeedBase {
  id: string
  /** Cuándo pasó (ISO): ordena el feed. */
  at: string
  user: PublicUser
}

/** Empezó, terminó o abandonó una obra (su diario). */
export interface FeedLogItem extends FeedBase {
  kind: 'started' | 'finished' | 'abandoned'
  work: FeedWork
  /** Día que eligió en su diario ("YYYY-MM-DD"). */
  day: string | null
  rating: number | null
  /** Volvió a verla/leerla. */
  repeat: boolean
  /** Su reseña de la obra, cuando la terminó. */
  review: string | null
}

/** Creó una lista pública. */
export interface FeedListItem extends FeedBase {
  kind: 'list'
  list: ListSummary
}

export type FeedItem = FeedLogItem | FeedListItem

export interface FeedPage {
  items: FeedItem[]
  /** Se manda como `before` para pedir la siguiente página; null si no hay más. */
  nextBefore: string | null
}
