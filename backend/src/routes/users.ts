import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { toPublicEntryDTO, toPublicUserDTO } from '../lib/serialize'
import { LIST_SUMMARY_INCLUDE, toListSummaryDTO } from './lists'

export const userRoutes = new Hono<AuthEnv>()

userRoutes.use('*', requireAuth)

const MAX_ENTRIES = 60
const MAX_PEOPLE = 30

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
 * GET /users/:id (o /users/me) -> perfil público de un usuario
 *   { user, tagline, quote, isPublic, isSelf, isFollowing, followers, following, entries, lists }
 *
 * Si el perfil es privado (`Profile.isPublic = false`) y no es el propio,
 * `entries` viene vacío: sólo se muestran los datos básicos. Las notas de
 * cada obra sólo se incluyen si el dueño las marcó como públicas.
 * `lists` son sus listas públicas (visibles aunque el perfil sea privado).
 */
userRoutes.get('/:id', async (c) => {
  const me = c.get('userId')
  // `/users/me` = cómo ven los demás el perfil propio.
  const id = resolveId(c.req.param('id'), me)
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      profile: { select: { handle: true, avatar: true, tagline: true, quote: true, isPublic: true } },
      _count: { select: { followers: true, following: true } },
    },
  })
  if (!user) return c.json({ message: 'No existe el usuario.' }, 404)

  const isSelf = id === me
  const isPublic = user.profile?.isPublic ?? false

  const [entries, lists, follow] = await Promise.all([
    isPublic || isSelf
      ? prisma.mediaEntry.findMany({ where: { userId: id }, orderBy: { updatedAt: 'desc' }, take: MAX_ENTRIES })
      : Promise.resolve([]),
    // Las listas públicas se ven aunque el perfil sea privado: cada lista decide.
    prisma.list.findMany({
      where: { userId: id, isPublic: true },
      include: LIST_SUMMARY_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    }),
    isSelf ? Promise.resolve(null) : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me, followingId: id } } }),
  ])

  return c.json({
    user: toPublicUserDTO(user),
    tagline: user.profile?.tagline ?? '',
    quote: user.profile?.quote ?? '',
    isPublic,
    isSelf,
    isFollowing: Boolean(follow),
    followers: user._count.followers,
    following: user._count.following,
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
