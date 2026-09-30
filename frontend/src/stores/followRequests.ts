/**
 * Solicitudes para seguirme (cuenta privada, como en Instagram). Las usan el
 * contador de "Personas" en la barra lateral y la sección "Solicitudes" de
 * esa pantalla, así aceptar o rechazar actualiza los dos a la vez.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { socialService } from '../services/socialService'
import type { FollowRequestPerson } from '../types/social'

export const useFollowRequestsStore = defineStore('followRequests', () => {
  const items = ref<FollowRequestPerson[]>([])
  /** Aceptadas en esta sesión: Personas las sigue mostrando para poder seguirlas de vuelta. */
  const accepted = ref<FollowRequestPerson[]>([])
  const loaded = ref(false)

  const count = computed(() => items.value.length)

  /** Vuelve a pedir la lista (al entrar a la app y a Personas). Si falla, deja la anterior. */
  async function load(): Promise<void> {
    try {
      items.value = await socialService.followRequests()
      loaded.value = true
    } catch {
      // Sin solicitudes a la vista: no bloquea nada.
    }
  }

  /** Acepta: esa persona pasa a seguirme y ve mi perfil completo. */
  async function accept(userId: string): Promise<void> {
    await socialService.acceptRequest(userId)
    const person = items.value.find((p) => p.id === userId)
    items.value = items.value.filter((p) => p.id !== userId)
    if (person) accepted.value = [person, ...accepted.value]
  }

  async function reject(userId: string): Promise<void> {
    await socialService.rejectRequest(userId)
    items.value = items.value.filter((p) => p.id !== userId)
  }

  return { items, accepted, loaded, count, load, accept, reject }
})
