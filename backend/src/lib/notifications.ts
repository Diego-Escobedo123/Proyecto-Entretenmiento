import type { Notification, Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Notificaciones de Mosaic. Se crean desde las rutas cuando pasa algo que el
 * usuario debe saber:
 *
 * - follow           alguien empezó a seguirte (cuenta pública)
 * - follow_request   alguien pidió seguirte (cuenta privada)
 * - follow_accepted  aceptaron tu solicitud para seguir
 * - goal_completed   cumpliste una meta anual
 * - work_approved    un admin aprobó la obra que pediste agregar a mano
 * - work_rejected    un admin rechazó la obra que pediste agregar a mano
 */
export type NotificationType =
  | 'follow'
  | 'follow_request'
  | 'follow_accepted'
  | 'goal_completed'
  | 'work_approved'
  | 'work_rejected'

/** Datos públicos de quien provocó la notificación. */
const ACTOR_SELECT = {
  id: true,
  name: true,
  profile: { select: { handle: true, avatar: true } },
} as const

export const NOTIFICATION_INCLUDE = { actor: { select: ACTOR_SELECT } } as const

type NotificationWithActor = Notification & {
  actor: { id: string; name: string; profile: { handle: string; avatar: string | null } | null } | null
}

export function toNotificationDTO(n: NotificationWithActor) {
  return {
    id: n.id,
    type: n.type as NotificationType,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
    actor: n.actor
      ? { id: n.actor.id, name: n.actor.name, handle: n.actor.profile?.handle ?? '', avatar: n.actor.profile?.avatar ?? null }
      : null,
    data: (n.data ?? null) as Record<string, unknown> | null,
  }
}

/**
 * Crea una notificación para `userId`. Nunca avisa a alguien de algo que hizo
 * él mismo. Si ya hay una igual sin leer (misma persona, mismo tipo), no la
 * repite: así seguir, dejar de seguir y volver a seguir no llena la campana.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  options: { actorId?: string; ref?: string; data?: Prisma.InputJsonValue } = {},
): Promise<void> {
  const { actorId, ref, data } = options
  if (actorId && actorId === userId) return

  const duplicate = await prisma.notification.findFirst({
    where: { userId, type, actorId: actorId ?? null, ref: ref ?? null, readAt: null },
    select: { id: true },
  })
  if (duplicate) return

  await prisma.notification.create({ data: { userId, type, actorId: actorId ?? null, ref: ref ?? null, data } })
}

/** Borra el aviso de una solicitud que ya no está pendiente (cancelada, aceptada o rechazada). */
export async function clearFollowRequestNotification(targetId: string, requesterId: string): Promise<void> {
  await prisma.notification.deleteMany({ where: { userId: targetId, actorId: requesterId, type: 'follow_request' } })
}

/**
 * Revisa las metas anuales del usuario y avisa de las que acaba de cumplir.
 * El avance se cuenta igual que en la pantalla: obras terminadas ese año
 * (sin abandonar), del tipo de la meta o de cualquiera si es "all".
 *
 * Se llama después de cualquier cambio que pueda terminar una obra (o de
 * guardar una meta). Cada meta avisa una sola vez por objetivo: si el usuario
 * sube la meta de 20 a 30 y la vuelve a cumplir, recibe otro aviso.
 */
export async function checkGoalsCompleted(userId: string): Promise<void> {
  const goals = await prisma.goal.findMany({ where: { userId } })

  for (const goal of goals) {
    const ref = `${goal.id}:${goal.target}`
    const alreadyNotified = await prisma.notification.findFirst({
      where: { userId, type: 'goal_completed', ref },
      select: { id: true },
    })
    if (alreadyNotified) continue

    const done = await prisma.logEntry.count({
      where: {
        userId,
        abandoned: false,
        finishedAt: { gte: new Date(`${goal.year}-01-01T00:00:00Z`), lt: new Date(`${goal.year + 1}-01-01T00:00:00Z`) },
        ...(goal.type !== 'all' && { entry: { type: goal.type } }),
      },
    })
    if (done >= goal.target) {
      await notify(userId, 'goal_completed', {
        ref,
        data: { year: goal.year, type: goal.type, target: goal.target },
      })
    }
  }
}