import { Hono } from 'hono'
import type { Prisma, Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireAdmin, requireAuth, type AuthEnv } from '../middleware/auth'

/**
 * Panel de administración. Todas las rutas exigen sesión (requireAuth) y rol
 * ADMIN (requireAdmin); un USER normal recibe 403.
 *
 * Regla de seguridad: un admin no puede quitarse el rol ni borrarse a sí
 * mismo. Así siempre queda al menos un admin y nadie se queda fuera del panel
 * por accidente.
 */
export const adminRoutes = new Hono<AuthEnv>()

adminRoutes.use('*', requireAuth, requireAdmin)

const ROLES: readonly Role[] = ['USER', 'ADMIN']
const MAX_USERS = 100
const DAY_MS = 24 * 60 * 60 * 1000

const ADMIN_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  profile: { select: { handle: true, avatar: true } },
  _count: { select: { entries: true, lists: true } },
} as const satisfies Prisma.UserSelect

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>

function toAdminUserDTO(u: AdminUserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    handle: u.profile?.handle ?? '',
    avatar: u.profile?.avatar ?? null,
    createdAt: u.createdAt.toISOString(),
    entries: u._count.entries,
    lists: u._count.lists,
  }
}

// GET /admin/stats -> números generales de la plataforma
adminRoutes.get('/stats', async (c) => {
  const weekAgo = new Date(Date.now() - 7 * DAY_MS)
  const [users, admins, newUsers, entries, reviews, lists] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.mediaEntry.count(),
    prisma.mediaEntry.count({ where: { review: { not: '' } } }),
    prisma.list.count(),
  ])
  return c.json({ users, admins, newUsers, entries, reviews, lists })
})

// GET /admin/users?q=texto&role=ADMIN|USER -> usuarios más recientes primero
adminRoutes.get('/users', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  const role = c.req.query('role')

  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { profile: { handle: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(role === 'USER' || role === 'ADMIN' ? { role } : {}),
  }

  const users = await prisma.user.findMany({
    where,
    select: ADMIN_USER_SELECT,
    orderBy: { createdAt: 'desc' },
    take: MAX_USERS,
  })
  return c.json(users.map(toAdminUserDTO))
})

// PATCH /admin/users/:id/role  { role: 'USER' | 'ADMIN' }
adminRoutes.patch('/users/:id/role', async (c) => {
  const id = c.req.param('id')
  const { role } = await c.req.json().catch(() => ({}))

  if (!ROLES.includes(role)) return c.json({ message: 'Rol inválido. Usa USER o ADMIN.' }, 400)
  if (id === c.get('userId')) {
    return c.json({ message: 'No puedes cambiar tu propio rol.' }, 400)
  }

  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return c.json({ message: 'Usuario no encontrado.' }, 404)

  const user = await prisma.user.update({ where: { id }, data: { role }, select: ADMIN_USER_SELECT })
  return c.json(toAdminUserDTO(user))
})

// DELETE /admin/users/:id -> borra la cuenta y todo lo suyo (cascade)
adminRoutes.delete('/users/:id', async (c) => {
  const id = c.req.param('id')
  if (id === c.get('userId')) {
    return c.json({ message: 'No puedes eliminar tu propia cuenta desde el panel.' }, 400)
  }

  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return c.json({ message: 'Usuario no encontrado.' }, 404)

  await prisma.user.delete({ where: { id } })
  return c.body(null, 204)
})