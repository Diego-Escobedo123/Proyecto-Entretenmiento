/**
 * useAuthStore — autenticación contra el backend (POST /auth/login|register, GET /auth/me).
 *
 * El token JWT vive en localStorage (via lib/api). El usuario se mantiene en
 * memoria y se revalida contra /auth/me al arrancar. La forma pública del store
 * (user, isAuthenticated, login/register/logout) no cambió respecto de la
 * versión simulada: las pantallas y el guard del router siguen igual.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, apiFetch, getToken, setToken } from '../lib/api'

interface AuthUser {
  id: string
  name: string
  email: string
}

interface AuthResponse {
  token: string
  user: AuthUser
}

type Result = { ok: true } | { ok: false; message: string }

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  // Optimista: si hay token guardado asumimos sesión hasta que /auth/me diga lo contrario.
  const hasToken = ref(getToken() !== null)

  const isAuthenticated = computed(() => hasToken.value)

  function setSession(res: AuthResponse): void {
    setToken(res.token)
    user.value = res.user
    hasToken.value = true
  }

  async function login(email: string, password: string): Promise<Result> {
    try {
      setSession(await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }))
      return { ok: true }
    } catch (e) {
      return { ok: false, message: e instanceof ApiError ? e.message : 'No se pudo iniciar sesión.' }
    }
  }

  async function register(name: string, email: string, password: string): Promise<Result> {
    try {
      setSession(
        await apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: { name, email, password } }),
      )
      return { ok: true }
    } catch (e) {
      return { ok: false, message: e instanceof ApiError ? e.message : 'No se pudo crear la cuenta.' }
    }
  }

  async function loginWithGoogle(): Promise<Result> {
    // TODO(backend): el backend todavía no expone OAuth con Google.
    return { ok: false, message: 'El inicio con Google todavía no está disponible.' }
  }

  function logout(): void {
    setToken(null)
    user.value = null
    hasToken.value = false
  }

  /** Revalida la sesión al arrancar la app. Si el token no sirve, cierra sesión. */
  async function restore(): Promise<void> {
    if (!getToken()) return
    try {
      const { user: me } = await apiFetch<{ user: AuthUser }>('/auth/me')
      user.value = me
      hasToken.value = true
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) logout()
    }
  }

  return { user, isAuthenticated, login, loginWithGoogle, register, logout, restore }
})
