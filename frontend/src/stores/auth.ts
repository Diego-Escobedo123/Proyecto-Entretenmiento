/**
 * useAuthStore — autenticación simulada mientras no existe backend.
 *
 * TODO(backend): reemplazar login()/register() por POST /auth/login y
 * POST /auth/register reales (con bcrypt, JWT, etc. según el SOW). La forma
 * de la función pública (login/register/logout, isAuthenticated, currentUser)
 * se mantiene igual para que las pantallas no cambien cuando eso pase —
 * solo cambia lo que hay adentro de cada función.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'mosaic:auth'

interface AuthUser {
  name: string
  email: string
}

interface StoredAuth {
  user: AuthUser
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

export const useAuthStore = defineStore('auth', () => {
  const stored = loadStoredAuth()
  const user = ref<AuthUser | null>(stored?.user ?? null)

  const isAuthenticated = computed(() => user.value !== null)

  async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
    await fakeNetworkDelay()

    // TODO(backend): validación real de credenciales contra la base de datos.
    if (!email.includes('@')) return { ok: false, message: 'Ingresa un correo válido.' }
    if (password.length < 6) return { ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' }

    const name = email.split('@')[0]
    user.value = { name: name.charAt(0).toUpperCase() + name.slice(1), email }
    persistAuth({ user: user.value })
    return { ok: true }
  }

  async function loginWithGoogle(): Promise<{ ok: true } | { ok: false; message: string }> {
    await fakeNetworkDelay(500)
    // TODO(backend): flujo OAuth real contra Google, intercambio de token en el backend.
    user.value = { name: 'Usuario de Google', email: 'usuario@gmail.com' }
    persistAuth({ user: user.value })
    return { ok: true }
  }

  async function register(
    name: string,
    email: string,
    password: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
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
  }

  return { user, isAuthenticated, login, loginWithGoogle, register, logout }
})