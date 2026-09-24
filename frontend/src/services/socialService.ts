/** Reseñas de la comunidad (`/reviews`) y perfiles públicos (`/users`). */
import type { PublicProfile, WorkKey, WorkReviews } from '../types/review'
import { apiFetch } from '../lib/api'

export interface SocialService {
  reviewsFor(work: WorkKey): Promise<WorkReviews>
  publicProfile(userId: string): Promise<PublicProfile>
}

class HttpSocialService implements SocialService {
  reviewsFor(work: WorkKey): Promise<WorkReviews> {
    const params = new URLSearchParams({ type: work.type, title: work.title })
    if (work.externalId) params.set('externalId', work.externalId)
    return apiFetch<WorkReviews>(`/reviews?${params.toString()}`)
  }

  publicProfile(userId: string): Promise<PublicProfile> {
    return apiFetch<PublicProfile>(`/users/${encodeURIComponent(userId)}`)
  }
}

export const socialService: SocialService = new HttpSocialService()

export { HttpSocialService }
