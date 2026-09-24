/**
 * useAuthStore — autenticación contra el backend (POST /auth/login|register|google, GET /auth/me).
 *
 * El token JWT vive en localStorage (via lib/api). El usuario se mantiene en
 * memoria y se revalida contra /auth/me al arrancar. La forma pública del store
 * (user, isAuthenticated, login/register/logout) no cambió respecto de la
 * versión simulada: las pantallas y el guard del router siguen igual.
 *
 * Google: el botón de Google Identity Services entrega un ID token que se
 * manda al backend (POST /auth/google). El backend es quien verifica la firma
 * del token; el frontend nunca confía en su contenido.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, apiFetch, getToken, setToken } from '../lib/api'

interface AuthUser {
  id: string
  name: string
  email: string
  avatarUrl?: string
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

  /**
   * Login real con Google: recibe el ID token del botón de Google y lo
   * manda al backend, que lo verifica y devuelve nuestra propia sesión.
   */
  async function loginWithGoogleCredential(idToken: string): Promise<Result> {
    try {
      setSession(await apiFetch<AuthResponse>('/auth/google', { method: 'POST', body: { idToken } }))
      return { ok: true }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        return { ok: false, message: 'El inicio con Google todavía no está disponible en el servidor.' }
      }
      return { ok: false, message: e instanceof ApiError ? e.message : 'No se pudo iniciar sesión con Google.' }
    }
  }

  function logout(): void {
    setToken(null)
    user.value = null
    hasToken.value = false
    // Evita que Google vuelva a iniciar sesión solo en la próxima visita.
    window.google?.accounts.id.disableAutoSelect()
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

  return { user, isAuthenticated, login, loginWithGoogleCredential, register, logout, restore }
})
