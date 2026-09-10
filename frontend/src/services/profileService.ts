/**
 * Acceso a datos del perfil del usuario. Misma idea que `mediaService`:
 * la app depende de la interfaz, no de dónde vive el dato.
 */
import type { UserProfile } from '../types/media'
import { delay, readJson, writeJson } from './storage'

export interface ProfileService {
  get(): Promise<UserProfile>
  update(patch: Partial<UserProfile>): Promise<UserProfile>
}

const STORAGE_KEY = 'mosaic.profile.v1'

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Tu perfil',
  handle: '',
  avatar: null,
  tagline: 'Tu identidad cultural',
  quote: 'Cada obra cuenta una historia. Juntas cuentan la tuya.',
  memberSince: null,
}

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

export const profileService: ProfileService = new LocalProfileService()
