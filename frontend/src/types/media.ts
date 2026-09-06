/**
 * Modelo de dominio — una "obra" registrada en Mosaic (película, libro, juego, álbum).
 * Todo el resto de la app (stores, screens, componentes) depende de estos tipos.
 */

export type MediaType = 'movie' | 'book' | 'game' | 'music'

export type MediaStatus = 'want' | 'in-progress' | 'completed'

export interface MediaEntry {
  id: string
  type: MediaType
  title: string
  /** Director, autor, estudio o artista según el tipo. */
  creator: string
  status: MediaStatus
  /** Año de estreno/publicación. `null` si el usuario no lo indica. Alimenta la stat de décadas. */
  year: number | null
  /** 0–5. `null` cuando el usuario todavía no la califica. */
  rating: number | null
  /** 0–100. Sólo relevante para status `in-progress`; `null` en otro caso. */
  progress: number | null
  favorite: boolean
  genres: string[]
  notes: string
  /** URL de portada; `null` muestra un placeholder. */
  cover: string | null
  createdAt: string
  updatedAt: string
}

/** Campos que el usuario controla desde el formulario (sin metadatos del sistema). */
export type MediaEntryInput = Omit<MediaEntry, 'id' | 'createdAt' | 'updatedAt'>

/** Datos editables del perfil del usuario. Vive aparte de las obras. */
export interface UserProfile {
  name: string
  handle: string
  avatar: string | null
  tagline: string
  quote: string
  /** Año en que empezó a registrar obras. `null` hasta que exista la primera. */
  memberSince: number | null
}
