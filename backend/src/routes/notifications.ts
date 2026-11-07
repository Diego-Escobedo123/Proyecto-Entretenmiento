import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { NOTIFICATION_INCLUDE, toNotificationDTO } from '../lib/notifications'

/** Notificaciones del usuario actual (la campana de la barra superior). */
export const notificationRoutes = new Hono<AuthEnv>()

notificationRoutes.use('*', requireAuth)

const MAX_NOTIFICATIONS = 30

// GET /notifications -> { items, unread }  (las 30 más recientes + cuántas sin leer en total)
notificationRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      include: NOTIFICATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: MAX_NOTIFICATIONS,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])
  return c.json({ items: rows.map(toNotificationDTO), unread })
})

// POST /notifications/read-all -> 204   Marca todas como leídas.
notificationRoutes.post('/read-all', async (c) => {
  await prisma.notification.updateMany({
    where: { userId: c.get('userId'), readAt: null },
    data: { readAt: new Date() },
  })
  return c.body(null, 204)
})

// POST /notifications/:id/read -> 204   Marca una como leída (sólo si es mía).
notificationRoutes.post('/:id/read', async (c) => {
  const { count } = await prisma.notification.updateMany({
    where: { id: c.req.param('id'), userId: c.get('userId'), readAt: null },
    data: { readAt: new Date() },
  })
  if (!count) {
    const exists = await prisma.notification.findFirst({
      where: { id: c.req.param('id'), userId: c.get('userId') },
      select: { id: true },
    })
    if (!exists) return c.json({ message: 'No existe esa notificación.' }, 404)
  }
  return c.body(null, 204)
})