/** Secciones de Explorar (backend `/explore`). */
import type { MediaType } from './media'
import type { ExternalSearchResult } from './search'

export type ExploreSection = 'trending' | 'upcoming' | 'gems' | 'community' | 'foryou'

export interface ExploreItem extends ExternalSearchResult {
  type: MediaType
  /** Contexto corto: "Sale el 15 oct", "12 personas · ★ 4,3", "Porque te gustó Dune". */
  note?: string
  /** Sinopsis (Joyas escondidas). */
  description?: string
}
