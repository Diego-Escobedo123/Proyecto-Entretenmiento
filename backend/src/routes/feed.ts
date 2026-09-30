import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { toPublicUserDTO } from '../lib/serialize'
import { upgradeBookCover } from '../lib/externalSearch'
import { LIST_SUMMARY_INCLUDE, toListSummaryDTO } from './lists'

export const feedRoutes = new Hono<AuthEnv>()

feedRoutes.use('*', requireAuth)

const PAGE_SIZE = 20
const MAX_REVIEW = 280

const USER_SELECT = { id: true, name: true, profile: { select: { handle: true, avatar: true } } } as const

/**
 * GET /feed?before=<ISO> -> { items, nextBefore }
 *
 * Actividad de la gente que sigue el usuario, lo más reciente primero:
 * - su diario (empezó / terminó / abandonó una obra), sólo si su perfil es
 *   público: con perfil privado su colección no se comparte;
 * - sus listas públicas nuevas (cada lista decide su visibilidad).
 *
 * Paginado por fecha: `nextBefore` se manda como `before` para la siguiente
 * página; null cuando no hay más.
 */
feedRoutes.get('/', async (c) => {
  const me = c.get('userId')
  const beforeParam = c.req.query('before')
  const before = beforeParam && !Number.isNaN(Date.parse(beforeParam)) ? new Date(beforeParam) : new Date()

  const follows = await prisma.follow.findMany({ where: { followerId: me }, select: { followingId: true } })
  const ids = follows.map((f) => f.followingId)
  if (!ids.length) return c.json({ items: [], nextBefore: null })

  // Se piden PAGE_SIZE + 1 de cada fuente: al mezclarlas, sobra con qué saber si hay más.
  const [logs, lists] = await Promise.all([
    prisma.logEntry.findMany({
      // updatedAt: terminar algo que ya estaba empezado actualiza la misma entrada.
      where: { userId: { in: ids }, updatedAt: { lt: before }, user: { profile: { isPublic: true } } },
      orderBy: { updatedAt: 'desc' },
      take: PAGE_SIZE + 1,
      include: {
        user: { select: USER_SELECT },
        entry: {
          select: { type: true, title: true, creator: true, year: true, cover: true, genres: true, externalId: true, review: true },
        },
      },
    }),
    prisma.list.findMany({
      where: { userId: { in: ids }, isPublic: true, createdAt: { lt: before } },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE + 1,
      include: { ...LIST_SUMMARY_INCLUDE, user: { select: USER_SELECT } },
    }),
  ])

  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

  // La reseña es de la obra, no de cada vez: va sólo en la última vez que la terminó.
  const latestFinished = new Set(
    (
      await prisma.logEntry.findMany({
        where: { entryId: { in: [...new Set(logs.map((l) => l.entryId))] }, finishedAt: { not: null }, abandoned: false },
        orderBy: [{ entryId: 'asc' }, { finishedAt: 'desc' }, { createdAt: 'desc' }],
        distinct: ['entryId'],
        select: { id: true },
      })
    ).map((l) => l.id),
  )

  const all = [
    ...logs.map((l) => ({
      id: `log:${l.id}`,
      kind: !l.finishedAt ? ('started' as const) : l.abandoned ? ('abandoned' as const) : ('finished' as const),
      at: l.updatedAt.toISOString(),
      user: toPublicUserDTO(l.user),
      work: {
        type: l.entry.type,
        title: l.entry.title,
        creator: l.entry.creator,
        year: l.entry.year,
        cover: upgradeBookCover(l.entry.cover),
        genres: l.entry.genres,
        externalId: l.entry.externalId,
      },
      day: day(l.finishedAt ?? l.startedAt),
      rating: l.rating,
      repeat: l.repeat,
      // La reseña de la obra (siempre pública) acompaña a la última vez que la terminó.
      review: latestFinished.has(l.id) && l.entry.review.trim() ? l.entry.review.trim().slice(0, MAX_REVIEW) : null,
    })),
    ...lists.map((list) => ({
      id: `list:${list.id}`,
      kind: 'list' as const,
      at: list.createdAt.toISOString(),
      user: toPublicUserDTO(list.user),
      list: toListSummaryDTO(list),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const items = all.slice(0, PAGE_SIZE)
  const hasMore = all.length > PAGE_SIZE
  return c.json({ items, nextBefore: hasMore ? items[items.length - 1].at : null })
})
