/**
 * Modelo de dominio — una "obra" registrada en Mosaic (película, serie, libro, juego, álbum).
 * Todo el resto de la app (stores, screens, componentes) depende de estos tipos.
 */

export type MediaType = 'movie' | 'series' | 'book' | 'game' | 'music'

/**
 * `mastered` (100%) sólo aplica a juegos y `abandoned` a series, libros y
 * juegos; los estados válidos de cada tipo están en `lib/catalog.ts`.
 */
export type MediaStatus = 'want' | 'in-progress' | 'completed' | 'mastered' | 'abandoned'

export interface MediaEntry {
  id: string
  type: MediaType
  title: string
  /** Director, creador/a, autor, estudio o artista según el tipo. */
  creator: string
  status: MediaStatus
  /** Año de estreno/publicación. `null` si el usuario no lo indica. Alimenta la stat de décadas. */
  year: number | null
  /** 0.5–5 en medios puntos. `null` cuando el usuario todavía no la califica. */
  rating: number | null
  /**
   * 0–100. Sólo relevante para status `in-progress`/`abandoned`; `null` en
   * otro caso. En libros y series se deriva de páginas/episodios.
   */
  progress: number | null
  /** Libros: página actual y total. */
  pagesRead: number | null
  pagesTotal: number | null
  /** Series: temporada y episodio por el que va. */
  season: number | null
  episode: number | null
  /** Juegos: horas jugadas y plataforma. */
  hoursPlayed: number | null
  platform: string | null
  favorite: boolean
  genres: string[]
  /** Comentario que acompaña la calificación. Siempre público (reseñas de la obra). */
  review: string
  /** Notas personales. Privadas salvo que `notesPublic`; aun así sólo se ven en el perfil. */
  notes: string
  notesPublic: boolean
  /** URL de portada; `null` muestra un placeholder. */
  cover: string | null
  /** Id en el catálogo externo (p. ej. "tmdb:438631"); `null` si se ingresó a mano. */
  externalId: string | null
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
  /** Preferencia de visibilidad. Se guarda, pero hoy no hay vista pública que la respete. */
  isPublic: boolean
}
