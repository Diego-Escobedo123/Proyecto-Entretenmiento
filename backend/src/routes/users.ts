import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { toPublicEntryDTO, toPublicUserDTO } from '../lib/serialize'
import { LIST_SUMMARY_INCLUDE, toListSummaryDTO } from './lists'
import { toLogDTO } from '../lib/logs'
import { ratingSummary } from '../lib/ratings'
import { culturalDna } from '../lib/dna'

export const userRoutes = new Hono<AuthEnv>()

userRoutes.use('*', requireAuth)

const MAX_ENTRIES = 60
const MAX_PEOPLE = 30
const MAX_RECENT = 6

/** Datos de la obra que acompañan a cada entrada de "actividad reciente". */
const LOG_ENTRY_SELECT = {
  id: true,
  type: true,
  title: true,
  creator: true,
  cover: true,
  externalId: true,
  genres: true,
  year: true,
} as const

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  profile: { select: { handle: true, avatar: true } },
} as const

/** `me` = el usuario actual. */
const resolveId = (param: string, me: string) => (param === 'me' ? me : param)

/** Usuarios públicos + si el usuario actual ya los sigue. */
async function withFollowState(
  me: string,
  users: { id: string; name: string; profile: { handle: string; avatar: string | null } | null }[],
) {
  const followed = await prisma.follow.findMany({
    where: { followerId: me, followingId: { in: users.map((u) => u.id) } },
    select: { followingId: true },
  })
  const set = new Set(followed.map((f) => f.followingId))
  return users.map((u) => ({ ...toPublicUserDTO(u), isFollowing: set.has(u.id), isSelf: u.id === me }))
}

// GET /users/search?q=ana -> personas por nombre o @usuario (sin el propio).
// Va antes de /:id para que "search" no se tome como un id.
userRoutes.get('/search', async (c) => {
  const q = c.req.query('q')?.trim().replace(/^@/, '') ?? ''
  if (q.length < 2) return c.json([])
  const me = c.get('userId')
  const users = await prisma.user.findMany({
    where: {
      id: { not: me },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { profile: { handle: { contains: q, mode: 'insensitive' } } },
      ],
    },
    select: PUBLIC_USER_SELECT,
    orderBy: { name: 'asc' },
    take: MAX_PEOPLE,
  })
  return c.json(await withFollowState(me, users))
})

/**
 * GET /users/suggestions -> personas con gustos parecidos, para empezar a seguir.
 *
 * Perfiles públicos que todavía no sigues, ordenados por cuántas obras tienen
 * en común contigo (mismo id de catálogo). Cada una trae `shared` (cuántas) y
 * hasta 3 títulos de ejemplo. Si no hay coincidencias, las más activas.
 */
userRoutes.get('/suggestions', async (c) => {
  const me = c.get('userId')
  const [mine, following] = await Promise.all([
    prisma.mediaEntry.findMany({ where: { userId: me, externalId: { not: null } }, select: { externalId: true } }),
    prisma.follow.findMany({ where: { followerId: me }, select: { followingId: true } }),
  ])
  const exclude = [me, ...following.map((f) => f.followingId)]
  const myIds = mine.map((m) => m.externalId!)

  const shared = myIds.length
    ? await prisma.mediaEntry.groupBy({
        by: ['userId'],
        where: { externalId: { in: myIds }, userId: { notIn: exclude }, user: { profile: { isPublic: true } } },
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      })
    : []

  let rows = shared.map((s) => ({ userId: s.userId, shared: s._count._all }))
  if (!rows.length) {
    // Sin obras en común: las cuentas públicas con más obras registradas.
    const active = await prisma.mediaEntry.groupBy({
      by: ['userId'],
      where: { userId: { notIn: exclude }, user: { profile: { isPublic: true } } },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    })
    rows = active.map((a) => ({ userId: a.userId, shared: 0 }))
  }
  if (!rows.length) return c.json([])

  const ids = rows.map((r) => r.userId)
  const [users, samples] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: PUBLIC_USER_SELECT }),
    myIds.length
      ? prisma.mediaEntry.findMany({
          where: { userId: { in: ids }, externalId: { in: myIds } },
          select: { userId: true, title: true },
          orderBy: { rating: { sort: 'desc', nulls: 'last' } },
        })
      : Promise.resolve([] as { userId: string; title: string }[]),
  ])
  const byId = new Map(users.map((u) => [u.id, u]))
  const people = await withFollowState(
    me,
    ids.map((id) => byId.get(id)).filter((u): u is NonNullable<typeof u> => Boolean(u)),
  )
  return c.json(
    people.map((p) => ({
      ...p,
      shared: rows.find((r) => r.userId === p.id)?.shared ?? 0,
      sharedTitles: samples.filter((s) => s.userId === p.id).slice(0, 3).map((s) => s.title),
    })),
  )
})

/**
 * GET /users/:id (o /users/me) -> el perfil de una persona, tal como se ve en
 * su página (la misma para ella y para los demás):
 *   { user, tagline, quote, memberSince, isPublic, isSelf, isFollowing,
 *     followers, following, counts, favorites, recent, ratings, dna, activity, entries, lists }
 *
 * `dna` (géneros, década, formato, % terminado) y `activity` (días del último
 * año en que empezó o terminó algo, uno por registro) alimentan "ADN cultural"
 * y "Constancia" en los perfiles públicos.
 *
 * Con perfil privado (y si no es el propio) sólo viajan los datos básicos, los
 * contadores de seguidores y sus listas públicas: nada de su colección
 * (`favorites`, `recent`, `ratings` y `entries` vacíos, `counts.works` en 0).
 * Las notas de cada obra sólo se incluyen si el dueño las marcó como públicas.
 */
userRoutes.get('/:id', async (c) => {
  const me = c.get('userId')
  const id = resolveId(c.req.param('id'), me)
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      profile: {
        select: { handle: true, avatar: true, tagline: true, quote: true, isPublic: true, memberSince: true, topPicks: true },
      },
      _count: { select: { followers: true, following: true } },
    },
  })
  if (!user) return c.json({ message: 'No existe el usuario.' }, 404)

  const isSelf = id === me
  const isPublic = user.profile?.isPublic ?? false
  const canSee = isPublic || isSelf
  const topPicks = user.profile?.topPicks ?? []
  const yearStart = new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`)

  const yearAgo = new Date(Date.now() - 371 * 86_400_000)
  const [entries, lists, follow, works, finishedThisYear, listCount, favorites, recent, rated, collection, activityLogs, lastAbandoned] = await Promise.all([
    canSee
      ? prisma.mediaEntry.findMany({ where: { userId: id }, orderBy: { updatedAt: 'desc' }, take: MAX_ENTRIES })
      : Promise.resolve([]),
    // Las listas públicas se ven aunque el perfil sea privado: cada lista decide.
    prisma.list.findMany({
      where: { userId: id, isPublic: true },
      include: LIST_SUMMARY_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    }),
    isSelf
      ? Promise.resolve(null)
      : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me, followingId: id } } }),
    canSee ? prisma.mediaEntry.count({ where: { userId: id } }) : Promise.resolve(0),
    canSee
      ? prisma.logEntry.count({ where: { userId: id, finishedAt: { gte: yearStart }, abandoned: false } })
      : Promise.resolve(0),
    // Uno mismo cuenta todas sus listas; los demás, sólo las públicas.
    prisma.list.count({ where: { userId: id, ...(!isSelf && { isPublic: true }) } }),
    canSee && topPicks.length
      ? prisma.mediaEntry.findMany({ where: { id: { in: topPicks }, userId: id } })
      : Promise.resolve([]),
    canSee
      ? prisma.logEntry.findMany({
          where: { userId: id },
          orderBy: { updatedAt: 'desc' },
          take: MAX_RECENT,
          include: { entry: { select: LOG_ENTRY_SELECT } },
        })
      : Promise.resolve([]),
    canSee
      ? prisma.mediaEntry.findMany({ where: { userId: id, rating: { not: null } }, select: { rating: true } })
      : Promise.resolve([]),
    canSee
      ? prisma.mediaEntry.findMany({ where: { userId: id }, select: { genres: true, year: true, type: true, status: true } })
      : Promise.resolve([]),
    canSee
      ? prisma.logEntry.findMany({
          where: { userId: id, OR: [{ startedAt: { gte: yearAgo } }, { finishedAt: { gte: yearAgo } }] },
          select: { startedAt: true, finishedAt: true, entry: { select: { title: true, type: true, genres: true } } },
        })
      : Promise.resolve([]),
    canSee
      ? prisma.mediaEntry.findFirst({
          where: { userId: id, status: 'abandoned' },
          orderBy: { updatedAt: 'desc' },
          select: { title: true },
        })
      : Promise.resolve(null),
  ])

  const day = (d: Date | null) => (d && d >= yearAgo ? d.toISOString().slice(0, 10) : null)

  // En el orden que eligió; si borró una obra de su colección, simplemente no aparece.
  const favoriteById = new Map(favorites.map((f) => [f.id, f]))

  return c.json({
    user: toPublicUserDTO(user),
    tagline: user.profile?.tagline ?? '',
    quote: user.profile?.quote ?? '',
    memberSince: user.profile?.memberSince ?? null,
    isPublic,
    isSelf,
    isFollowing: Boolean(follow),
    followers: user._count.followers,
    following: user._count.following,
    counts: { works, finishedThisYear, lists: listCount },
    favorites: topPicks.flatMap((pick) => {
      const f = favoriteById.get(pick)
      return f ? [toPublicEntryDTO(f)] : []
    }),
    recent: recent.map(toLogDTO),
    ratings: ratingSummary(rated.map((r) => r.rating)),
    dna: culturalDna(collection),
    // Cada vez que empezó o terminó algo en el último año, con la obra ("Tu año en obras").
    activity: activityLogs.flatMap((l) =>
      [day(l.startedAt), day(l.finishedAt)]
        .filter((d): d is string => Boolean(d))
        .map((date) => ({ date, title: l.entry.title, type: l.entry.type, genres: l.entry.genres })),
    ),
    lastAbandoned: lastAbandoned?.title ?? null,
    entries: entries.map(toPublicEntryDTO),
    lists: lists.map(toListSummaryDTO),
  })
})

// POST /users/:id/follow -> { followers }   (idempotente)
userRoutes.post('/:id/follow', async (c) => {
  const me = c.get('userId')
  const id = c.req.param('id')
  if (id === me) return c.json({ message: 'No puedes seguirte a ti mismo.' }, 400)
  const exists = await prisma.user.count({ where: { id } })
  if (!exists) return c.json({ message: 'No existe el usuario.' }, 404)

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: me, followingId: id } },
    create: { followerId: me, followingId: id },
    update: {},
  })
  return c.json({ followers: await prisma.follow.count({ where: { followingId: id } }) })
})

// DELETE /users/:id/follow -> { followers }   (idempotente)
userRoutes.delete('/:id/follow', async (c) => {
  const me = c.get('userId')
  const id = c.req.param('id')
  await prisma.follow.deleteMany({ where: { followerId: me, followingId: id } })
  return c.json({ followers: await prisma.follow.count({ where: { followingId: id } }) })
})

// GET /users/:id/followers -> quienes lo siguen (con si el usuario actual los sigue)
userRoutes.get('/:id/followers', async (c) => {
  const me = c.get('userId')
  const rows = await prisma.follow.findMany({
    where: { followingId: resolveId(c.req.param('id'), me) },
    orderBy: { createdAt: 'desc' },
    select: { follower: { select: PUBLIC_USER_SELECT } },
  })
  return c.json(await withFollowState(me, rows.map((r) => r.follower)))
})

// GET /users/:id/following -> a quienes sigue
userRoutes.get('/:id/following', async (c) => {
  const me = c.get('userId')
  const rows = await prisma.follow.findMany({
    where: { followerId: resolveId(c.req.param('id'), me) },
    orderBy: { createdAt: 'desc' },
    select: { following: { select: PUBLIC_USER_SELECT } },
  })
  return c.json(await withFollowState(me, rows.map((r) => r.following)))
})
