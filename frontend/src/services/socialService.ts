/** Reseñas de la comunidad (`/reviews`) y perfiles públicos (`/users`). */
import type { PublicProfile, WorkKey, WorkReviews, WorkStats } from '../types/review'
import { apiFetch } from '../lib/api'

export interface SocialService {
  reviewsFor(work: WorkKey): Promise<WorkReviews>
  /** Números de la obra en todo Mosaic: estados, estrellas, veces terminada. */
  statsFor(work: WorkKey): Promise<WorkStats>
  publicProfile(userId: string): Promise<PublicProfile>
}

function workParams(work: WorkKey): string {
  const params = new URLSearchParams({ type: work.type, title: work.title })
  if (work.externalId) params.set('externalId', work.externalId)
  return params.toString()
}

class HttpSocialService implements SocialService {
  reviewsFor(work: WorkKey): Promise<WorkReviews> {
    return apiFetch<WorkReviews>(`/reviews?${workParams(work)}`)
  }

  statsFor(work: WorkKey): Promise<WorkStats> {
    return apiFetch<WorkStats>(`/reviews/stats?${workParams(work)}`)
  }

  publicProfile(userId: string): Promise<PublicProfile> {
    return apiFetch<PublicProfile>(`/users/${encodeURIComponent(userId)}`)
  }
}

export const socialService: SocialService = new HttpSocialService()

export { HttpSocialService }
