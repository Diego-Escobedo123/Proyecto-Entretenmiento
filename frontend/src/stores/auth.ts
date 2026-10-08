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
 *
 * Roles: `user.role` es USER o ADMIN. `isAdmin` solo sirve para mostrar u
 * ocultar cosas en la interfaz; quien de verdad protege las rutas /admin es
 * el backend (responde 403 a quien no sea ADMIN).
 *
 * Analítica: al entrar se manda a PostHog `user_registered` (cuenta nueva) o
 * `user_logged_in` (cuenta existente). Ver lib/analytics.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, apiFetch, getToken, setToken } from '../lib/api'
import type { Role } from '../types/admin'
import { identifyUser, resetAnalytics, track, type AuthMethod } from '../lib/analytics'

interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  avatarUrl?: string
}

interface AuthResponse {
  token: string
  user: AuthUser
  /** Solo en /auth/google: true si la cuenta se acaba de crear. */
  isNew?: boolean
}

type Result = { ok: true } | { ok: false; message: string }

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  // Optimista: si hay token guardado asumimos sesión hasta que /auth/me diga lo contrario.
  const hasToken = ref(getToken() !== null)

  const isAuthenticated = computed(() => hasToken.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  /** Guarda la sesión y avisa a la analítica si fue un registro o un inicio de sesión. */
  function setSession(res: AuthResponse, method: AuthMethod, isNew: boolean): void {
    setToken(res.token)
    user.value = res.user
    hasToken.value = true
    identifyUser(res.user)
    track(isNew ? 'user_registered' : 'user_logged_in', { method })
  }

  async function login(email: string, password: string): Promise<Result> {
    try {
      setSession(await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }), 'email', false)
      return { ok: true }
    } catch (e) {
      return { ok: false, message: e instanceof ApiError ? e.message : 'No se pudo iniciar sesión.' }
    }
  }

  async function register(name: string, email: string, password: string): Promise<Result> {
    try {
      setSession(
        await apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: { name, email, password } }),
        'email',
        true,
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
      const res = await apiFetch<AuthResponse>('/auth/google', { method: 'POST', body: { idToken } })
      setSession(res, 'google', res.isNew === true)
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
    resetAnalytics()
    // Evita que Google vuelva a iniciar sesión solo en la próxima visita.
    window.google?.accounts.id.disableAutoSelect()
  }

  /**
   * Revalida la sesión contra /auth/me. Si el token no sirve, cierra sesión.
   * Si ya hay una revalidación en curso, devuelve esa misma (el guard del
   * router la espera antes de decidir si dejar entrar a /admin).
   */
  let restoring: Promise<void> | null = null

  function restore(): Promise<void> {
    if (!getToken()) return Promise.resolve()
    restoring ??= (async () => {
      try {
        const { user: me } = await apiFetch<{ user: AuthUser }>('/auth/me')
        user.value = me
        hasToken.value = true
        // Volvió con la sesión guardada: no es un login nuevo, solo se le reconoce.
        identifyUser(me)
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) logout()
      } finally {
        restoring = null
      }
    })()
    return restoring
  }

  return { user, isAuthenticated, isAdmin, login, loginWithGoogleCredential, register, logout, restore }
})