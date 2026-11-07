/** Secciones de Explorar con datos reales (backend `/explore`). */
import type { ExploreItem, ExploreSection } from '../types/explore'
import type { MediaType } from '../types/media'
import { apiFetch } from '../lib/api'
import { detectRegion } from '../lib/region'

export const exploreService = {
  async section(section: ExploreSection, type: MediaType | null): Promise<ExploreItem[]> {
    const params = new URLSearchParams({ type: type ?? 'all', region: detectRegion() })
    const res = await apiFetch<{ items: ExploreItem[] }>(`/explore/${section}?${params.toString()}`)
    return res.items
  },
}
