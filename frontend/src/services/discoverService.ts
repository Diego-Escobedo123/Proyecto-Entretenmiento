/**
 * Acceso al catálogo de descubrimiento. Misma idea que `mediaService`:
 * la app depende de la interfaz, no de dónde vive el dato. Implementación
 * activa: `HttpDiscoverService` (backend `/discover`).
 */
import type { DiscoverFilters, DiscoverResult } from '../types/discover'
import { apiFetch } from '../lib/api'
import { delay } from './storage'

export interface DiscoverService {
  get(filters?: DiscoverFilters): Promise<DiscoverResult>
}

function toQueryString(filters?: DiscoverFilters): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.genres?.length) params.set('genres', filters.genres.join(','))
  if (filters.minRating) params.set('minRating', String(filters.minRating))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Implementación HTTP contra el backend (`/discover`). */
class HttpDiscoverService implements DiscoverService {
  get(filters?: DiscoverFilters): Promise<DiscoverResult> {
    return apiFetch<DiscoverResult>(`/discover${toQueryString(filters)}`)
  }
}

const FALLBACK: DiscoverResult = {
  hiddenGems: [
    {
      id: 'fallback-1',
      kind: 'Cine',
      year: 1973,
      title: 'The Melancholy of Space',
      description:
        'Una obra maestra olvidada del sci-fi soviético, que explora el pavor existencial a través de paisajes glaciales.',
      cover: 'https://picsum.photos/seed/mosaic-melancholy/500/600',
      size: 'lg',
    },
    { id: 'fallback-2', kind: 'Literatura', title: 'Fragments of Time', cover: 'https://picsum.photos/seed/mosaic-fragments/300/300', size: 'sm' },
    { id: 'fallback-3', kind: 'Música', title: 'Midnight Sessions', cover: 'https://picsum.photos/seed/mosaic-midnight/300/300', size: 'sm' },
  ],
  awardWinners: [
    { id: 'fallback-4', title: 'The Architecture...', award: "Palme d'Or · 2023", cover: 'https://picsum.photos/seed/mosaic-award1/300/300' },
    { id: 'fallback-5', title: 'Concrete Brutali...', award: 'Best Doc · 2022', cover: 'https://picsum.photos/seed/mosaic-award2/300/300' },
    { id: 'fallback-6', title: 'Echoes of Dali', award: 'Visual Arts Prize', cover: 'https://picsum.photos/seed/mosaic-award3/300/300' },
    { id: 'fallback-7', title: 'Blue Period Revi...', award: "Curator's Choice", cover: 'https://picsum.photos/seed/mosaic-award4/300/300' },
  ],
}

/** Implementación local sin backend: devuelve el mismo catálogo de ejemplo siempre. */
class LocalDiscoverService implements DiscoverService {
  async get(filters?: DiscoverFilters): Promise<DiscoverResult> {
    await delay()
    const q = filters?.q?.trim().toLowerCase()
    if (!q) return FALLBACK
    return {
      hiddenGems: FALLBACK.hiddenGems.filter((g) => g.title.toLowerCase().includes(q) || g.kind.toLowerCase().includes(q)),
      awardWinners: FALLBACK.awardWinners.filter((a) => a.title.toLowerCase().includes(q)),
    }
  }
}

export const discoverService: DiscoverService = new HttpDiscoverService()

export { HttpDiscoverService, LocalDiscoverService }
