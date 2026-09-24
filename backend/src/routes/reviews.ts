import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { toPublicUserDTO } from '../lib/serialize'

export const reviewRoutes = new Hono<AuthEnv>()

reviewRoutes.use('*', requireAuth)

const VALID_TYPES = new Set(['movie', 'book', 'game', 'music'])
const MAX_REVIEWS = 30

/**
 * GET /reviews?type=movie&externalId=tmdb:123&title=Dune
 *   -> { average, ratingCount, reviews: [{ id, rating, review, updatedAt, user }] }
 *
 * Opiniones de los DEMÁS usuarios sobre una obra. La misma obra se reconoce
 * por su id de catálogo o, para obras ingresadas a mano (sin id), por tipo +
 * título. Sólo expone calificación y comentario: las notas nunca salen de
 * aquí, ni siquiera si son públicas (ésas se ven sólo en el perfil).
 */
reviewRoutes.get('/', async (c) => {
  const type = c.req.query('type') ?? ''
  const externalId = c.req.query('externalId')?.trim() || null
  const title = c.req.query('title')?.trim() || ''

  if (!VALID_TYPES.has(type)) {
    return c.json({ message: 'Tipo inválido. Usa movie, book, game o music.' }, 400)
  }
  if (!externalId && !title) {
    return c.json({ message: 'Falta externalId o title.' }, 400)
  }

  const sameWork: Prisma.MediaEntryWhereInput[] = []
  if (externalId) sameWork.push({ externalId })
  if (title) sameWork.push({ title: { equals: title, mode: 'insensitive' } })

  const rows = await prisma.mediaEntry.findMany({
    where: {
      type,
      userId: { not: c.get('userId') },
      OR: sameWork,
      AND: [{ OR: [{ rating: { not: null } }, { review: { not: '' } }] }],
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      rating: true,
      review: true,
      updatedAt: true,
      user: { select: { id: true, name: true, profile: { select: { handle: true, avatar: true } } } },
    },
  })

  const ratings = rows.map((r) => r.rating).filter((r): r is number => r != null)
  const average = ratings.length
    ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
    : null

  return c.json({
    average,
    ratingCount: ratings.length,
    reviews: rows
      .filter((r) => r.review.trim())
      .slice(0, MAX_REVIEWS)
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        review: r.review,
        updatedAt: r.updatedAt.toISOString(),
        user: toPublicUserDTO(r.user),
      })),
  })
})
