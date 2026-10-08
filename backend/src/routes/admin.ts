import { Hono } from 'hono'
import type { Prisma, Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireAdmin, requireAuth, type AuthEnv } from '../middleware/auth'
import { fromMediaInput } from '../lib/serialize'
import { parseDay, recordStatusChange } from '../lib/logs'
import { toWorkRequestDTO } from './workRequests'
import { checkGoalsCompleted, notify } from '../lib/notifications'
import { createMediaSchema } from '../lib/schemas'

/**
 * Panel de administración. Todas las rutas exigen sesión (requireAuth) y rol
 * ADMIN (requireAdmin); un USER normal recibe 403.
 *
 * También revisa las solicitudes de obras que los usuarios escribieron a mano
 * (no están en el catálogo): al aprobarla, la obra se agrega a la colección
 * de quien la pidió; al rechazarla, no se agrega nada.
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
  const [users, admins, newUsers, entries, reviews, lists, pendingRequests] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.mediaEntry.count(),
    prisma.mediaEntry.count({ where: { review: { not: '' } } }),
    prisma.list.count(),
    prisma.workRequest.count({ where: { status: 'pending' } }),
  ])
  return c.json({ users, admins, newUsers, entries, reviews, lists, pendingRequests })
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

// --- Solicitudes de obras escritas a mano ---

const REQUEST_USER = {
  user: { select: { id: true, name: true, email: true, profile: { select: { handle: true, avatar: true } } } },
} as const

// GET /admin/work-requests -> pendientes, las más antiguas primero (para atenderlas en orden)
adminRoutes.get('/work-requests', async (c) => {
  const rows = await prisma.workRequest.findMany({
    where: { status: 'pending' },
    include: REQUEST_USER,
    orderBy: { createdAt: 'asc' },
    take: MAX_USERS,
  })
  return c.json(rows.map(toWorkRequestDTO))
})

// POST /admin/work-requests/:id/approve -> crea la obra en la colección de quien la pidió
adminRoutes.post('/work-requests/:id/approve', async (c) => {
  const id = c.req.param('id')
  const request = await prisma.workRequest.findUnique({ where: { id }, include: REQUEST_USER })
  if (!request) return c.json({ message: 'Solicitud no encontrada.' }, 404)

  // Lo que llenó en el formulario (estado, calificación, notas...). Se revisa otra vez con las
  // reglas de POST /media por si la solicitud se guardó antes de que se validara al enviarla.
  const parsed = createMediaSchema.safeParse(request.payload)
  if (!parsed.success) {
    return c.json({ message: 'Esta solicitud tiene datos inválidos y no se puede aprobar. Recházala.' }, 422)
  }
  const payload = parsed.data

  // Se marca como aprobada sólo si sigue pendiente: así dos admins no la aprueban dos veces.
  const reviewedAt = new Date()
  const { count } = await prisma.workRequest.updateMany({
    where: { id, status: 'pending' },
    data: { status: 'approved', reviewedAt },
  })
  if (!count) return c.json({ message: 'Esa solicitud ya fue revisada.' }, 409)

  try {
    // Con los datos de la obra revisados.
    const entry = await prisma.mediaEntry.create({
      data: {
        ...fromMediaInput(payload),
        type: request.type,
        title: request.title,
        creator: request.creator,
        year: request.year,
        genres: request.genres,
        cover: null,
        externalId: null,
        userId: request.userId,
      } as never,
    })
    // Igual que POST /media: si ya la empezó o terminó, queda en su diario con las fechas que eligió.
    const day = parseDay(payload.logDate) ?? new Date(new Date().toISOString().slice(0, 10))
    const start = parseDay(payload.startDate)
    await recordStatusChange(entry, null, day, start && start <= day ? start : null)
    // Si con esta obra cumple una meta anual, le llega la notificación.
    await checkGoalsCompleted(request.userId)
  } catch (err) {
    // Si no se pudo crear la obra, la solicitud vuelve a quedar pendiente.
    await prisma.workRequest.update({ where: { id }, data: { status: 'pending', reviewedAt: null } })
    throw err
  }

  await notify(request.userId, 'work_approved', { ref: id, data: { title: request.title, type: request.type } })
  return c.json(toWorkRequestDTO({ ...request, status: 'approved', reviewedAt }))
})

// POST /admin/work-requests/:id/reject -> no se agrega nada
adminRoutes.post('/work-requests/:id/reject', async (c) => {
  const id = c.req.param('id')
  const request = await prisma.workRequest.findUnique({ where: { id }, include: REQUEST_USER })
  if (!request) return c.json({ message: 'Solicitud no encontrada.' }, 404)

  const reviewedAt = new Date()
  const { count } = await prisma.workRequest.updateMany({
    where: { id, status: 'pending' },
    data: { status: 'rejected', reviewedAt },
  })
  if (!count) return c.json({ message: 'Esa solicitud ya fue revisada.' }, 409)

  await notify(request.userId, 'work_rejected', { ref: id, data: { title: request.title, type: request.type } })
  return c.json(toWorkRequestDTO({ ...request, status: 'rejected', reviewedAt }))
})