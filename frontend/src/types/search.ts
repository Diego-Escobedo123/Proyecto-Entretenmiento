/** Resultado de buscar en la fuente externa correspondiente al tipo de obra. */
export interface ExternalSearchResult {
  externalId: string
  title: string
  creator: string
  year: number | null
  cover: string | null
  genres: string[]
}

export interface ExternalSearchResponse {
  available: boolean
  results: ExternalSearchResult[]
}
