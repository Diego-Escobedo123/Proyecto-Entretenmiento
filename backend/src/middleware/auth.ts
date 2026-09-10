import type { MiddlewareHandler } from 'hono'
import { verifyToken } from '../lib/auth'

/** Variables que este middleware deja en el contexto de Hono. */
export type AuthEnv = { Variables: { userId: string } }

/** Exige `Authorization: Bearer <token>` válido; si no, responde 401. */
export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const payload = token ? await verifyToken(token) : null

  if (!payload) return c.json({ message: 'No autorizado.' }, 401)

  c.set('userId', payload.sub)
  await next()
}
