/**
 * Modelo de la pantalla de descubrimiento (`/discover`): catálogo curado,
 * no las obras del usuario (ver `types/media.ts`).
 */

export interface HiddenGem {
  id: string
  kind: string
  year?: number
  title: string
  description?: string
  cover: string
  size: 'lg' | 'sm'
}

export interface AwardWinner {
  id: string
  title: string
  award: string
  cover: string
}

export interface DiscoverResult {
  hiddenGems: HiddenGem[]
  awardWinners: AwardWinner[]
}

export interface DiscoverFilters {
  q?: string
  genres?: string[]
  minRating?: number
}
