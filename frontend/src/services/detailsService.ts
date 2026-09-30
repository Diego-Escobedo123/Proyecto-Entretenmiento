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
