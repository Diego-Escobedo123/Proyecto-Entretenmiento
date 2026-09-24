/** Autocompletado contra catálogos externos (backend `/search`). */
import type { MediaType } from '../types/media'
import type { ExternalSearchResponse, ExternalSearchResult } from '../types/search'
import { apiFetch } from '../lib/api'

export interface SearchService {
  search(type: MediaType, query: string): Promise<ExternalSearchResponse>
}

class HttpSearchService implements SearchService {
  search(type: MediaType, query: string): Promise<ExternalSearchResponse> {
    const params = new URLSearchParams({ type, q: query })
    return apiFetch<ExternalSearchResponse>(`/search?${params.toString()}`)
  }
}

export const searchService: SearchService = new HttpSearchService()

export interface CatalogGroup {
  type: MediaType
  results: ExternalSearchResult[]
}

/**
 * Busca en varios catálogos en paralelo. Un tipo que falla o no está
 * configurado (sin API key) simplemente no aparece: no rompe al resto.
 */
export async function searchCatalogs(types: readonly MediaType[], query: string): Promise<CatalogGroup[]> {
  const settled = await Promise.allSettled(types.map((t) => searchService.search(t, query)))
  return types
    .map((type, i) => {
      const res = settled[i]
      const results = res.status === 'fulfilled' && res.value.available ? res.value.results : []
      return { type, results }
    })
    .filter((g) => g.results.length > 0)
}

export { HttpSearchService }
