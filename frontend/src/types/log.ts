/** Entrada del diario: una vez que el usuario vio/leyó/jugó/escuchó una obra (backend `/logs`). */
import type { MediaEntry } from './media'

export interface LogEntry {
  id: string
  entryId: string
  /** Días "YYYY-MM-DD". `finishedAt` null = sigue en curso. */
  startedAt: string | null
  finishedAt: string | null
  rating: number | null
  /** Volver a verla/leerla. */
  repeat: boolean
  abandoned: boolean
  createdAt: string
  /** Datos de la obra (vienen en el listado general del diario). */
  entry?: Pick<MediaEntry, 'id' | 'type' | 'title' | 'creator' | 'cover' | 'externalId' | 'genres' | 'year'>
}

export interface LogInput {
  startedAt?: string | null
  finishedAt?: string | null
  rating?: number | null
  abandoned?: boolean
}
