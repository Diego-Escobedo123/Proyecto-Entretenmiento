/**
 * Store del perfil del usuario (nombre, handle, frase, avatar).
 * Los datos "culturales" derivados (géneros, evolución, logros) NO viven aquí:
 * se calculan a partir de las obras en `useCulturalProfile`.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_PROFILE, profileService } from '../services/profileService'
import type { UserProfile } from '../types/media'

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<UserProfile>({ ...DEFAULT_PROFILE })
  const loading = ref(false)
  const loaded = ref(false)

  async function ensureLoaded(): Promise<void> {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      profile.value = await profileService.get()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(patch: Partial<UserProfile>): Promise<void> {
    profile.value = await profileService.update(patch)
  }

  return { profile, loading, loaded, ensureLoaded, updateProfile }
})
