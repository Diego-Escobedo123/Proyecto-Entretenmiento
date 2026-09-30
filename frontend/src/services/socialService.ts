/** Reseñas de la comunidad (`/reviews`), perfiles públicos y seguir (`/users`) y el feed (`/feed`). */
import type { PublicProfile, WorkKey, WorkReviews, WorkStats } from '../types/review'
import type { FeedPage, Person, SuggestedPerson } from '../types/social'
import { apiFetch } from '../lib/api'

export interface SocialService {
  reviewsFor(work: WorkKey): Promise<WorkReviews>
  /** Números de la obra en todo Mosaic: estados, estrellas, veces terminada. */
  statsFor(work: WorkKey): Promise<WorkStats>
  publicProfile(userId: string): Promise<PublicProfile>
  /** Devuelven el nuevo número de seguidores de esa persona. */
  follow(userId: string): Promise<{ followers: number }>
  unfollow(userId: string): Promise<{ followers: number }>
  followers(userId: string): Promise<Person[]>
  following(userId: string): Promise<Person[]>
  searchPeople(query: string): Promise<Person[]>
  suggestions(): Promise<SuggestedPerson[]>
  /** Actividad de quienes sigue el usuario; `before` = `nextBefore` de la página anterior. */
  feed(before?: string): Promise<FeedPage>
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

  follow(userId: string): Promise<{ followers: number }> {
    return apiFetch(`/users/${encodeURIComponent(userId)}/follow`, { method: 'POST' })
  }

  unfollow(userId: string): Promise<{ followers: number }> {
    return apiFetch(`/users/${encodeURIComponent(userId)}/follow`, { method: 'DELETE' })
  }

  followers(userId: string): Promise<Person[]> {
    return apiFetch<Person[]>(`/users/${encodeURIComponent(userId)}/followers`)
  }

  following(userId: string): Promise<Person[]> {
    return apiFetch<Person[]>(`/users/${encodeURIComponent(userId)}/following`)
  }

  searchPeople(query: string): Promise<Person[]> {
    return apiFetch<Person[]>(`/users/search?${new URLSearchParams({ q: query }).toString()}`)
  }

  suggestions(): Promise<SuggestedPerson[]> {
    return apiFetch<SuggestedPerson[]>('/users/suggestions')
  }

  feed(before?: string): Promise<FeedPage> {
    return apiFetch<FeedPage>(before ? `/feed?${new URLSearchParams({ before }).toString()}` : '/feed')
  }
}

export const socialService: SocialService = new HttpSocialService()

export { HttpSocialService }
