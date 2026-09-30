/** Secciones de Explorar (backend `/explore`). */
import type { MediaType } from './media'
import type { ExternalSearchResult } from './search'

export type ExploreSection = 'trending' | 'upcoming' | 'gems' | 'community' | 'foryou'

export interface ExploreItem extends ExternalSearchResult {
  type: MediaType
  /** Contexto corto: "Sale el 15 oct", "12 personas", "Porque te gustó Dune". */
  note?: string
  /** Calificación 0–5 en Joyas escondidas y Popular en Mosaic (se dibuja con ícono de estrella). */
  rating?: number
  /** Sinopsis (Joyas escondidas). */
  description?: string
}
