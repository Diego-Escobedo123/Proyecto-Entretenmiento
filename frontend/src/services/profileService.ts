/**
 * Acceso a datos del perfil del usuario. Misma idea que `mediaService`:
 * la app depende de la interfaz, no de dónde vive el dato. Implementación
 * activa: `HttpProfileService` (backend `/profile`).
 */
import type { UserProfile } from '../types/media'
import { apiFetch } from '../lib/api'
import { delay, readJson, writeJson } from './storage'

export interface ProfileService {
  get(): Promise<UserProfile>
  update(patch: Partial<UserProfile>): Promise<UserProfile>
}

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Tu perfil',
  handle: '',
  avatar: null,
  tagline: 'Tu identidad cultural',
  quote: 'Cada obra cuenta una historia. Juntas cuentan la tuya.',
  memberSince: null,
}

/** Implementación HTTP contra el backend (`/profile`). */
class HttpProfileService implements ProfileService {
  get(): Promise<UserProfile> {
    return apiFetch<UserProfile>('/profile')
  }

  update(patch: Partial<UserProfile>): Promise<UserProfile> {
    return apiFetch<UserProfile>('/profile', { method: 'PATCH', body: patch })
  }
}

const STORAGE_KEY = 'mosaic.profile.v1'

/** Implementación local sobre localStorage. Sin backend. */
class LocalProfileService implements ProfileService {
  async get(): Promise<UserProfile> {
    await delay(80)
    return { ...DEFAULT_PROFILE, ...readJson<Partial<UserProfile>>(STORAGE_KEY, {}) }
  }

  async update(patch: Partial<UserProfile>): Promise<UserProfile> {
    await delay()
    const next = { ...(await this.get()), ...patch }
    writeJson(STORAGE_KEY, next)
    return next
  }
}

export const profileService: ProfileService = new HttpProfileService()

export { HttpProfileService, LocalProfileService }
