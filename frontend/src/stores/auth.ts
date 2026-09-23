/**
 * useAuthStore — autenticación simulada mientras no existe backend.
 *
 * TODO(backend): reemplazar login()/register() por POST /auth/login y
 * POST /auth/register reales (con bcrypt, JWT, etc. según el SOW). La forma
 * de la función pública (login/register/logout, isAuthenticated, user)
 * se mantiene igual para que las pantallas no cambien cuando eso pase —
 * solo cambia lo que hay adentro de cada función.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'mosaic:auth'

interface AuthUser {
  name: string
  email: string
  avatarUrl?: string
}

interface StoredAuth {
  user: AuthUser
}

type AuthResult = { ok: true } | { ok: false; message: string }

/** Datos que vienen dentro del ID token de Google. */
interface GoogleIdTokenPayload {
  sub: string
  email: string
  name?: string
  picture?: string
}

function loadStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredAuth) : null
  } catch {
    return null
  }
}

function persistAuth(state: StoredAuth | null): void {
  if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  else localStorage.removeItem(STORAGE_KEY)
}

/** Simula latencia de red para que el loading se sienta real. */
function fakeNetworkDelay(ms = 700): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Decodifica el payload del JWT de Google (base64url + UTF-8).
 * OJO: NO verifica la firma. Solo sirve mientras no haya backend.
 */
function decodeGoogleIdToken(token: string): GoogleIdTokenPayload {
  const part = token.split('.')[1]
  if (!part) throw new Error('Token de Google inválido')
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const json = decodeURIComponent(
    atob(padded)
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  )
  return JSON.parse(json) as GoogleIdTokenPayload
}

export const useAuthStore = defineStore('auth', () => {
  const stored = loadStoredAuth()
  const user = ref<AuthUser | null>(stored?.user ?? null)

  const isAuthenticated = computed(() => user.value !== null)

  async function login(email: string, password: string): Promise<AuthResult> {
    await fakeNetworkDelay()

    // TODO(backend): validación real de credenciales contra la base de datos.
    if (!email.includes('@')) return { ok: false, message: 'Ingresa un correo válido.' }
    if (password.length < 6) return { ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' }

    const name = email.split('@')[0]
    user.value = { name: name.charAt(0).toUpperCase() + name.slice(1), email }
    persistAuth({ user: user.value })
    return { ok: true }
  }

  /**
   * Versión simulada (sin Google real). Se deja por si alguna pantalla,
   * como register.vue, todavía la usa.
   */
  async function loginWithGoogle(): Promise<AuthResult> {
    await fakeNetworkDelay(500)
    // TODO(backend): flujo OAuth real contra Google, intercambio de token en el backend.
    user.value = { name: 'Usuario de Google', email: 'usuario@gmail.com' }
    persistAuth({ user: user.value })
    return { ok: true }
  }

  /**
   * Login real con Google Identity Services: recibe el ID token que
   * devuelve el botón de Google y arma la sesión con sus datos.
   */
  async function loginWithGoogleCredential(idToken: string): Promise<AuthResult> {
    // TODO(backend): mandar idToken a POST /auth/google. El backend debe
    // verificar la firma con las llaves públicas de Google y devolver
    // nuestra propia sesión. Nunca confiar en este payload para nada sensible.
    try {
      const payload = decodeGoogleIdToken(idToken)
      if (!payload.email) return { ok: false, message: 'Google no devolvió un correo.' }

      user.value = {
        name: payload.name ?? payload.email.split('@')[0],
        email: payload.email,
        avatarUrl: payload.picture,
      }
      persistAuth({ user: user.value })
      return { ok: true }
    } catch {
      return { ok: false, message: 'No se pudo iniciar sesión con Google. Intenta de nuevo.' }
    }
  }

  async function register(name: string, email: string, password: string): Promise<AuthResult> {
    await fakeNetworkDelay()

    // TODO(backend): hash con bcrypt, chequeo de correo duplicado, envío de
    // correo de verificación (ver SOW, sección de autenticación).
    if (!name.trim()) return { ok: false, message: 'Ingresa tu nombre.' }
    if (!email.includes('@')) return { ok: false, message: 'Ingresa un correo válido.' }
    if (password.length < 6) return { ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' }

    user.value = { name, email }
    persistAuth({ user: user.value })
    return { ok: true }
  }

  function logout(): void {
    user.value = null
    persistAuth(null)
    // Evita que Google vuelva a iniciar sesión solo en la próxima visita.
    window.google?.accounts.id.disableAutoSelect()
  }

  return { user, isAuthenticated, login, loginWithGoogle, loginWithGoogleCredential, register, logout }
})