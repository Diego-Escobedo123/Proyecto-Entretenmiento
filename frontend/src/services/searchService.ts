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
 *
 * `onPartial` (opcional) recibe los grupos que ya llegaron, en el orden de
 * `types`, cada vez que responde un catálogo. Así la pantalla puede mostrar
 * las películas sin esperar al catálogo más lento (p. ej. libros).
 */
export async function searchCatalogs(
  types: readonly MediaType[],
  query: string,
  onPartial?: (groups: CatalogGroup[]) => void,
): Promise<CatalogGroup[]> {
  const done: (ExternalSearchResult[] | undefined)[] = types.map(() => undefined)
  const collect = () =>
    types
      .map((type, i) => ({ type, results: done[i] ?? [] }))
      .filter((g) => g.results.length > 0)

  await Promise.all(
    types.map(async (type, i) => {
      try {
        const res = await searchService.search(type, query)
        done[i] = res.available ? res.results : []
      } catch {
        done[i] = []
      }
      onPartial?.(collect())
    }),
  )
  return collect()
}

export { HttpSearchService }
