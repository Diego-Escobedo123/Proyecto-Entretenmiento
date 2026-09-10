/**
 * Cliente HTTP del backend. Único lugar del frontend que hace `fetch`.
 *
 * - Prefija todas las rutas con `VITE_API_URL`.
 * - Adjunta `Authorization: Bearer <token>` si hay sesión.
 * - Convierte respuestas no-2xx en `ApiError` con el `message` del backend.
 * - Guarda el token en localStorage para que la sesión sobreviva recargas.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const TOKEN_KEY = 'mosaic:token'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage no disponible: la sesión vive sólo en memoria */
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** Cuerpo a serializar como JSON. */
  body?: unknown
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options
  const token = getToken()

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor.', 0)
  }

  if (response.status === 204) return undefined as T

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : null) ?? `Error ${response.status}`
    throw new ApiError(message, response.status)
  }

  return data as T
}
