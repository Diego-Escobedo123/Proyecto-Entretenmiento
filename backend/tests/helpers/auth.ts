import { signToken } from '../../src/lib/auth'
import { db } from './prisma'

/**
 * Header `Authorization` de un usuario con sesión válida: firma un token real
 * y hace que la base falsa diga que la sesión sigue vigente (requireAuth).
 */
export async function authHeader(userId = 'user-1'): Promise<Record<string, string>> {
  const token = await signToken({ id: userId, sessionVersion: 0 })
  db.user.findUnique.mockResolvedValueOnce({ sessionVersion: 0 })
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

/** Usuario de la base con los campos que usan las rutas de /auth. */
export function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Ana',
    email: 'ana@correo.com',
    passwordHash: '',
    role: 'USER',
    emailVerifiedAt: null,
    pendingEmail: null,
    sessionVersion: 0,
    ...overrides,
  }
}

export const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/** Body JSON de una respuesta, sin pelear con los tipos en cada prueba. */
export const body = (res: Response): Promise<any> => res.json()
