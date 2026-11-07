import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { toPublicUserDTO } from '../lib/serialize'
import { ratingSummary } from '../lib/ratings'

export const reviewRoutes = new Hono<AuthEnv>()

reviewRoutes.use('*', requireAuth)

const VALID_TYPES = new Set(['movie', 'series', 'book', 'game', 'music'])
const MAX_REVIEWS = 30

/**
 * GET /reviews/stats?type=movie&externalId=tmdb:123&title=Dune
 *   -> { people, byStatus, rating: { average, count, histogram }, finishes, repeats, following }
 *
 * Números de la obra en todo Mosaic (incluido el usuario actual): cuánta gente
 * la tiene y en qué estado, la distribución de estrellas (10 barras, de ½ a 5)
 * y, desde el diario, cuántas veces se terminó y cuántas se repitió.
 *
 * La obra se reconoce por su id de catálogo; también cuentan las ingresadas a
 * mano (sin id) con el mismo tipo y título. Dos obras distintas con el mismo
 * título (Dune de 1984 y de 2021) no se mezclan porque sus ids difieren.
 *
 * `following`: quiénes de los que sigue el usuario la tienen (estado y
 * estrellas). Sólo perfiles públicos: con perfil privado la colección no se comparte.
 */
reviewRoutes.get('/stats', async (c) => {
  const type = c.req.query('type') ?? ''
  const externalId = c.req.query('externalId')?.trim() || null
  const title = c.req.query('title')?.trim() || ''

  if (!VALID_TYPES.has(type)) {
    return c.json({ message: 'Tipo inválido. Usa movie, series, book, game o music.' }, 400)
  }
  if (!externalId && !title) {
    return c.json({ message: 'Falta externalId o title.' }, 400)
  }

  const manualSameTitle: Prisma.MediaEntryWhereInput = {
    externalId: null,
    title: { equals: title, mode: 'insensitive' },
  }
  const where: Prisma.MediaEntryWhereInput = {
    type,
    OR: externalId ? [{ externalId }, ...(title ? [manualSameTitle] : [])] : [manualSameTitle],
  }

  const me = c.get('userId')
  const [entries, followed, finishedLogs] = await Promise.all([
    prisma.mediaEntry.findMany({ where, select: { userId: true, status: true, rating: true } }),
    prisma.mediaEntry.findMany({
      where: {
        ...where,
        // Seguirla ya implica permiso: en una cuenta privada, la solicitud fue aceptada.
        user: { followers: { some: { followerId: me } } },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        status: true,
        rating: true,
        user: { select: { id: true, name: true, profile: { select: { handle: true, avatar: true } } } },
      },
    }),
    prisma.logEntry.findMany({
      where: { entry: where, finishedAt: { not: null }, abandoned: false },
      select: { repeat: true },
    }),
  ])

  const byStatus = { want: 0, inProgress: 0, finished: 0, abandoned: 0 }
  for (const e of entries) {
    if (e.status === 'want') byStatus.want++
    else if (e.status === 'in-progress') byStatus.inProgress++
    else if (e.status === 'abandoned') byStatus.abandoned++
    else byStatus.finished++ // completed y mastered
  }

  return c.json({
    people: new Set(entries.map((e) => e.userId)).size,
    byStatus,
    rating: ratingSummary(entries.map((e) => e.rating)),
    finishes: finishedLogs.length,
    repeats: finishedLogs.filter((l) => l.repeat).length,
    following: followed.map((f) => ({ user: toPublicUserDTO(f.user), status: f.status, rating: f.rating })),
  })
})

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
    return c.json({ message: 'Tipo inválido. Usa movie, series, book, game o music.' }, 400)
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
