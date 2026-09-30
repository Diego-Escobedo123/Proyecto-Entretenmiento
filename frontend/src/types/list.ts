/** Listas de obras armadas por el usuario (backend `/lists`). */
import type { MediaEntry, MediaType } from './media'
import type { PublicUser } from './review'

/** Lo que muestra una tarjeta: sin las obras, sólo cuántas son y las primeras portadas. */
export interface ListSummary {
  id: string
  title: string
  description: string
  isPublic: boolean
  ranked: boolean
  itemCount: number
  covers: string[]
  updatedAt: string
  /** Sólo al preguntar por una obra: su id dentro de esta lista, o null si no está. */
  workItemId?: string | null
}

export interface ListItem {
  id: string
  position: number
  type: MediaType
  title: string
  creator: string
  year: number | null
  cover: string | null
  genres: string[]
  externalId: string | null
  /** Comentario del autor de la lista sobre esta obra. */
  note: string
  addedAt: string
}

export interface ListDetail {
  id: string
  title: string
  description: string
  isPublic: boolean
  ranked: boolean
  /** La lista es del usuario actual: puede editarla. */
  isOwner: boolean
  owner: PublicUser
  items: ListItem[]
  createdAt: string
  updatedAt: string
}

export interface ListInput {
  title: string
  description?: string
  isPublic?: boolean
  ranked?: boolean
}

/** Obra que se agrega a una lista: los datos del catálogo. */
export type ListWork = Pick<MediaEntry, 'type' | 'title' | 'creator' | 'year' | 'cover' | 'genres' | 'externalId'>
