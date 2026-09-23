/** Autocompletado contra catálogos externos (backend `/search`). */
import type { MediaType } from '../types/media'
import type { ExternalSearchResponse } from '../types/search'
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

export { HttpSearchService }
