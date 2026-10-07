import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { toPublicEntryDTO, toPublicUserDTO } from '../lib/serialize'
import { LIST_SUMMARY_INCLUDE, toListSummaryDTO } from './lists'
import { toLogDTO } from '../lib/logs'
import { ratingSummary } from '../lib/ratings'
import { culturalDna } from '../lib/dna'
import { profileInsights } from '../lib/insights'
import { clearFollowRequestNotification, notify } from '../lib/notifications'

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

/** Usuarios públicos + si el usuario actual ya los sigue o les mandó solicitud. */
async function withFollowState(
  me: string,
  users: { id: string; name: string; profile: { handle: string; avatar: string | null } | null }[],
) {
  const ids = users.map((u) => u.id)
  const [followed, requested] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: me, followingId: { in: ids } }, select: { followingId: true } }),
    prisma.followRequest.findMany({ where: { requesterId: me, targetId: { in: ids } }, select: { targetId: true } }),
  ])
  const following = new Set(followed.map((f) => f.followingId))
  const pending = new Set(requested.map((r) => r.targetId))
  return users.map((u) => ({
    ...toPublicUserDTO(u),
    isFollowing: following.has(u.id),
    requested: pending.has(u.id),
    isSelf: u.id === me,
  }))
}

/**
 * ¿Puede `me` ver el perfil completo de `id`? Sí si es el propio, si es
 * público o si lo sigue (en una cuenta privada, seguir = solicitud aceptada).
 */
async function canView(id: string, me: string) {
  if (id === me) return true
  const [profile, follow] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: id }, select: { isPublic: true } }),
    prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me, followingId: id } } }),
  ])
  return Boolean(profile?.isPublic || follow)
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

// GET /users/requests -> solicitudes pendientes para seguirme (cuenta privada), las más nuevas primero.
userRoutes.get('/requests', async (c) => {
  const me = c.get('userId')
  const rows = await prisma.followRequest.findMany({
    where: { targetId: me },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, requester: { select: PUBLIC_USER_SELECT } },
  })
  const people = await withFollowState(me, rows.map((r) => r.requester))
  return c.json(people.map((p, i) => ({ ...p, requestedAt: rows[i].createdAt.toISOString() })))
})

// POST /users/requests/:id/accept -> acepta la solicitud de :id (pasa a seguirme). { followers }
userRoutes.post('/requests/:id/accept', async (c) => {
  const me = c.get('userId')
  const requesterId = c.req.param('id')
  const { count } = await prisma.followRequest.deleteMany({ where: { requesterId, targetId: me } })
  if (!count) return c.json({ message: 'No hay una solicitud de esa persona.' }, 404)
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: requesterId, followingId: me } },
    create: { followerId: requesterId, followingId: me },
    update: {},
  })
  // La solicitud ya se respondió: se quita de mi campana y le aviso a quien la mandó.
  await clearFollowRequestNotification(me, requesterId)
  await notify(requesterId, 'follow_accepted', { actorId: me })
  return c.json({ followers: await prisma.follow.count({ where: { followingId: me } }) })
})

// DELETE /users/requests/:id -> rechaza la solicitud de :id (idempotente).
userRoutes.delete('/requests/:id', async (c) => {
  const me = c.get('userId')
  await prisma.followRequest.deleteMany({ where: { requesterId: c.req.param('id'), targetId: me } })
  await clearFollowRequestNotification(me, c.req.param('id'))
  return c.json({ ok: true })
})

/**
 * GET /users/:id (o /users/me) -> el perfil de una persona, tal como se ve en
 * su página (la misma para ella y para los demás):
 *   { user, tagline, quote, memberSince, isPublic, isSelf, isFollowing, requested,
 *     canView, pendingRequests, followers, following, counts, favorites, recent,
 *     ratings, dna, activity, entries, lists }
 *
 * `dna` (géneros, década, formato, % terminado) y `activity` (días del último
 * año en que empezó o terminó algo, uno por registro) alimentan "ADN cultural"
 * y "Constancia" en los perfiles públicos.
 *
 * Cuenta privada, como en Instagram: la ve completa (`canView`) su dueño y
 * quien la sigue (solicitud aceptada). Los demás sólo reciben los datos
 * básicos y sus listas públicas: nada de su colección ni sus seguidores
 * (`favorites`, `recent`, `ratings` y `entries` vacíos, `counts.works` en 0,
 * `followers`/`following` null). `requested`: ya le mandó solicitud.
 * `pendingRequests`: en el propio, cuántas solicitudes esperan respuesta.
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
  const [follow, request, pendingRequests] = await Promise.all([
    isSelf ? null : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me, followingId: id } } }),
    isSelf
      ? null
      : prisma.followRequest.findUnique({ where: { requesterId_targetId: { requesterId: me, targetId: id } } }),
    isSelf ? prisma.followRequest.count({ where: { targetId: me } }) : 0,
  ])
  // En una cuenta privada, seguirla = su dueño aceptó la solicitud.
  const canSee = isPublic || isSelf || Boolean(follow)
  const topPicks = user.profile?.topPicks ?? []
  const yearStart = new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`)

  const yearAgo = new Date(Date.now() - 371 * 86_400_000)
  const [entries, lists, works, finishedThisYear, listCount, favorites, recent, rated, collection, activityLogs, lastAbandoned, insights] = await Promise.all([
    canSee
      ? prisma.mediaEntry.findMany({ where: { userId: id }, orderBy: { updatedAt: 'desc' }, take: MAX_ENTRIES })
      : Promise.resolve([]),
    // Las listas públicas se ven aunque el perfil sea privado: cada lista decide.
    prisma.list.findMany({
      where: { userId: id, isPublic: true },
      include: LIST_SUMMARY_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    }),
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
    canSee ? profileInsights(id) : Promise.resolve(null),
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
    requested: Boolean(request),
    canView: canSee,
    pendingRequests,
    // Cuenta privada: ni cuántos la siguen ni a cuántos sigue (salvo su dueño y quien la sigue).
    followers: canSee ? user._count.followers : null,
    following: canSee ? user._count.following : null,
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
    insights,
    entries: entries.map(toPublicEntryDTO),
    lists: lists.map(toListSummaryDTO),
  })
})

/** Seguidores tras seguir / dejar de seguir; `null` si `me` no puede ver la cuenta. */
async function followersAfterChange(id: string, me: string) {
  return (await canView(id, me)) ? prisma.follow.count({ where: { followingId: id } }) : null
}

/**
 * POST /users/:id/follow -> { status, followers }   (idempotente)
 * Cuenta pública: la sigue (status "following"). Privada: le manda una
 * solicitud (status "requested") que su dueño acepta o rechaza.
 * `followers` es null si no puede ver la cuenta.
 */
userRoutes.post('/:id/follow', async (c) => {
  const me = c.get('userId')
  const id = c.req.param('id')
  if (id === me) return c.json({ message: 'No puedes seguirte a ti mismo.' }, 400)
  const target = await prisma.user.findUnique({
    where: { id },
    select: { profile: { select: { isPublic: true } }, followers: { where: { followerId: me }, select: { followerId: true } } },
  })
  if (!target) return c.json({ message: 'No existe el usuario.' }, 404)

  const alreadyFollowing = target.followers.length > 0
  if (!target.profile?.isPublic && !alreadyFollowing) {
    await prisma.followRequest.upsert({
      where: { requesterId_targetId: { requesterId: me, targetId: id } },
      create: { requesterId: me, targetId: id },
      update: {},
    })
    await notify(id, 'follow_request', { actorId: me })
    return c.json({ status: 'requested', followers: null })
  }

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: me, followingId: id } },
    create: { followerId: me, followingId: id },
    update: {},
  })
  if (!alreadyFollowing) await notify(id, 'follow', { actorId: me })
  return c.json({ status: 'following', followers: await followersAfterChange(id, me) })
})

// DELETE /users/:id/follow -> { status: "none", followers }   Deja de seguir o cancela la solicitud (idempotente).
userRoutes.delete('/:id/follow', async (c) => {
  const me = c.get('userId')
  const id = c.req.param('id')
  await prisma.$transaction([
    prisma.follow.deleteMany({ where: { followerId: me, followingId: id } }),
    prisma.followRequest.deleteMany({ where: { requesterId: me, targetId: id } }),
  ])
  // Si era una solicitud pendiente, ya no tiene sentido que le aparezca.
  await clearFollowRequestNotification(id, me)
  return c.json({ status: 'none', followers: await followersAfterChange(id, me) })
})

const PRIVATE_ACCOUNT = { message: 'Esta cuenta es privada.' }

// GET /users/:id/followers -> quienes lo siguen (con si el usuario actual los sigue). 403 si no puede verla.
userRoutes.get('/:id/followers', async (c) => {
  const me = c.get('userId')
  const id = resolveId(c.req.param('id'), me)
  if (!(await canView(id, me))) return c.json(PRIVATE_ACCOUNT, 403)
  const rows = await prisma.follow.findMany({
    where: { followingId: id },
    orderBy: { createdAt: 'desc' },
    select: { follower: { select: PUBLIC_USER_SELECT } },
  })
  return c.json(await withFollowState(me, rows.map((r) => r.follower)))
})

// GET /users/:id/following -> a quienes sigue. 403 si no puede verla.
userRoutes.get('/:id/following', async (c) => {
  const me = c.get('userId')
  const id = resolveId(c.req.param('id'), me)
  if (!(await canView(id, me))) return c.json(PRIVATE_ACCOUNT, 403)
  const rows = await prisma.follow.findMany({
    where: { followerId: id },
    orderBy: { createdAt: 'desc' },
    select: { following: { select: PUBLIC_USER_SELECT } },
  })
  return c.json(await withFollowState(me, rows.map((r) => r.following)))
})