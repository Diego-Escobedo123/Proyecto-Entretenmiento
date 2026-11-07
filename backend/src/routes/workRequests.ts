import { Hono, type MiddlewareHandler } from 'hono'
import type { Prisma, WorkRequest } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { validateBody } from '../lib/validation'
import { createMediaSchema } from '../lib/schemas'

/**
 * Solicitudes para agregar obras que no están en el catálogo.
 *
 * Una obra del catálogo (TMDB, Google Books, RAWG, iTunes) trae `externalId`
 * y se agrega directo. Una obra escrita a mano no: un USER la manda como
 * solicitud (POST /work-requests) y le llega al admin en /admin, que la
 * aprueba o la rechaza (ver routes/admin.ts). Los ADMIN sí pueden agregar
 * obras a mano directamente.
 */
export const workRequestRoutes = new Hono<AuthEnv>()

workRequestRoutes.use('*', requireAuth)

export const MAX_PENDING_PER_USER = 20

/** Datos que el admin ve de cada solicitud. */
export function toWorkRequestDTO(
  r: WorkRequest & { user?: { id: string; name: string; email: string; profile: { handle: string; avatar: string | null } | null } },
) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    creator: r.creator,
    year: r.year,
    genres: r.genres,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    ...(r.user && {
      user: {
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        handle: r.user.profile?.handle ?? '',
        avatar: r.user.profile?.avatar ?? null,
      },
    }),
  }
}

// POST /work-requests  (MediaEntryInput + logDate/startDate) -> 201 solicitud
workRequestRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  // Mismas reglas que POST /media: lo que se guarda es lo que se usará al aprobarla.
  const parsed = await validateBody(c, createMediaSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const year = body.year ?? null
  const genres = body.genres ?? []

  const pending = await prisma.workRequest.count({ where: { userId, status: 'pending' } })
  if (pending >= MAX_PENDING_PER_USER) {
    return c.json({ message: 'Tienes muchas solicitudes pendientes. Espera a que un administrador las revise.' }, 429)
  }

  // Una obra escrita a mano no tiene id de catálogo ni portada.
  const payload = { ...body, year, genres, externalId: null, cover: null } as Prisma.InputJsonObject
  const row = await prisma.workRequest.create({
    data: {
      userId,
      type: body.type,
      title: body.title,
      creator: body.creator ?? '',
      year,
      genres,
      payload,
    },
  })
  return c.json(toWorkRequestDTO(row), 201)
})

/**
 * Va antes de POST /media: un USER no puede agregar directo una obra escrita a
 * mano (sin `externalId`). Se permite si esa obra ya existe en Mosaic (por
 * ejemplo, otra persona la tiene porque un admin ya la aprobó): así se puede
 * agregar a la wishlist una obra que vio en el perfil de alguien más.
 */
export const manualEntryGuard: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const body = await c.req.json().catch(() => ({}))
  if (body.externalId) return next()

  const user = await prisma.user.findUnique({ where: { id: c.get('userId') }, select: { role: true } })
  if (user?.role === 'ADMIN') return next()

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const known =
    title && typeof body.type === 'string'
      ? await prisma.mediaEntry.findFirst({
          where: { type: body.type, title: { equals: title, mode: 'insensitive' } },
          select: { id: true },
        })
      : null
  if (known) return next()

  return c.json(
    { message: 'Las obras que no están en el catálogo pasan por revisión: mándala como solicitud.' },
    403,
  )
}