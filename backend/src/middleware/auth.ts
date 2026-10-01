import type { MiddlewareHandler } from 'hono'
import { verifyToken } from '../lib/auth'
import { prisma } from '../lib/prisma'

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

/**
 * Exige que el usuario sea ADMIN; si no, responde 403. Va siempre después de
 * `requireAuth`. El rol se lee de la base en cada request (no del token), así
 * que quitarle el rol a alguien surte efecto de inmediato, sin esperar a que
 * su token expire.
 */
export const requireAdmin: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const user = await prisma.user.findUnique({ where: { id: c.get('userId') }, select: { role: true } })
  if (!user) return c.json({ message: 'No autorizado.' }, 401)
  if (user.role !== 'ADMIN') return c.json({ message: 'Necesitas permisos de administrador.' }, 403)
  await next()
}