/** Ficha extendida (sinopsis, reparto, canciones, dónde consumirla) de una obra externa (backend `/details`). */
import type { WorkDetails } from '../types/details'
import { apiFetch } from '../lib/api'
import { detectRegion } from '../lib/region'

/** Fuentes con ficha extendida. El resto de `externalId` no se consulta. */
const SUPPORTED_PREFIXES = ['tmdb:', 'tmdb-tv:', 'googlebooks:', 'openlibrary:', 'rawg:', 'itunes:']

export function hasDetails(externalId: string | null | undefined): externalId is string {
  return !!externalId && SUPPORTED_PREFIXES.some((p) => externalId.startsWith(p))
}

export const detailsService = {
  get(externalId: string, region: string = detectRegion()): Promise<WorkDetails | null> {
    const params = new URLSearchParams({ externalId, region })
    return apiFetch<WorkDetails | null>(`/details?${params.toString()}`)
  },
}

/** Temporadas ya pedidas en esta sesión (el "+1 episodio" de Inicio no vuelve a pedirlas). */
const seasonsCache = new Map<string, Promise<WorkDetails['seasons']>>()

/** Temporadas de una serie (episodios por temporada); [] si no se conocen. */
export function seriesSeasons(externalId: string | null | undefined): Promise<WorkDetails['seasons']> {
  if (!hasDetails(externalId)) return Promise.resolve([])
  let seasons = seasonsCache.get(externalId)
  if (!seasons) {
    seasons = detailsService
      .get(externalId)
      .then((d) => d?.seasons ?? [])
      .catch(() => {
        seasonsCache.delete(externalId) // que se pueda reintentar
        return []
      })
    seasonsCache.set(externalId, seasons)
  }
  return seasons
}
