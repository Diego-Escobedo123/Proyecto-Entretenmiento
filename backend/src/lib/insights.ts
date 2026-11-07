/**
 * Insights del perfil que necesitan datos de fuera del ADN (el diario
 * completo o las notas de los demás). Cada uno es `null` cuando no hay datos
 * suficientes para decir algo interesante; el frontend elige los 3 más
 * llamativos entre estos y los que calcula por su cuenta.
 *
 * - against:     la obra donde su nota más se aleja del promedio de Mosaic.
 * - speed:       cuánto tarda en terminar algo (y su récord).
 * - timeTravel:  la obra más vieja respecto de cuándo la vio.
 * - rewatch:     la obra que más veces terminó.
 * - harsherWith: el tipo que peor califica frente al que mejor.
 * - era:         qué parte de lo que registra es reciente.
 * - explorer:    cuántos géneros cruza y cuáles son nuevos este año.
 * - backlog:     cuánto tardaría en vaciar su wishlist.
 * - affinity:    con quién de los que sigue comparte más obras.
 */
import { prisma } from './prisma'

const DAY = 86_400_000
/** Mínimo de otras personas que calificaron la obra para comparar. */
const MIN_COMMUNITY = 2
/** Diferencia mínima (en estrellas) para que valga la pena contarlo. */
const MIN_RATING_GAP = 1
/** Visionados con inicio y fin para hablar de velocidad. */
const MIN_TIMED = 2
/** Años mínimos entre el estreno y cuando la vio. */
const MIN_YEARS = 15
/** Veces terminada para "Vuelves a…". */
const MIN_REWATCHES = 2
/** Notas por tipo y diferencia mínima entre tipos para "Más exigente con…". */
const MIN_TYPE_RATINGS = 2
const MIN_TYPE_GAP = 0.5
/** Obras con año para "¿Presente o pasado?", y qué cuenta como reciente. */
const MIN_WITH_YEAR = 5
const RECENT_YEARS = 3
/** Géneros distintos para "Explorador". */
const MIN_GENRES = 5
/** Obras en la wishlist para "Tu pila de pendientes". */
const MIN_BACKLOG = 3
/** Obras en común con alguien que sigue para "Afinidad". */
const MIN_SHARED = 3

const TYPE_ORDER = ['movie', 'series', 'book', 'game', 'music']
const round1 = (n: number) => Math.round(n * 10) / 10

async function againstTheCurrent(userId: string) {
  const rated = await prisma.mediaEntry.findMany({
    where: { userId, rating: { not: null }, externalId: { not: null } },
    select: { title: true, type: true, externalId: true, rating: true },
  })
  if (!rated.length) return null

  const community = await prisma.mediaEntry.groupBy({
    by: ['type', 'externalId'],
    where: { userId: { not: userId }, rating: { not: null }, externalId: { in: rated.map((r) => r.externalId!) } },
    _avg: { rating: true },
    _count: { rating: true },
  })
  const byWork = new Map(community.map((c) => [`${c.type}|${c.externalId}`, c]))

  let best: { title: string; type: string; rating: number; community: number; voters: number } | null = null
  for (const r of rated) {
    const c = byWork.get(`${r.type}|${r.externalId}`)
    if (!c || c._count.rating < MIN_COMMUNITY || c._avg.rating == null) continue
    const gap = Math.abs(r.rating! - c._avg.rating)
    if (gap >= MIN_RATING_GAP && (!best || gap > Math.abs(best.rating - best.community))) {
      best = { title: r.title, type: r.type, rating: r.rating!, community: round1(c._avg.rating), voters: c._count.rating }
    }
  }
  return best
}

async function speed(userId: string) {
  const logs = await prisma.logEntry.findMany({
    where: { userId, startedAt: { not: null }, finishedAt: { not: null }, abandoned: false },
    select: { startedAt: true, finishedAt: true, entry: { select: { title: true, type: true } } },
  })
  const timed = logs.map((l) => ({
    title: l.entry.title,
    type: l.entry.type,
    // Empezado y terminado el mismo día cuenta como 1.
    days: Math.max(1, Math.round((l.finishedAt!.getTime() - l.startedAt!.getTime()) / DAY)),
  }))
  if (timed.length < MIN_TIMED) return null

  // Si un tipo tiene al menos 2, se habla de ese ("un libro te dura…"); si no, de todo.
  const byType = new Map<string, number[]>()
  for (const l of timed) byType.set(l.type, [...(byType.get(l.type) ?? []), l.days])
  const [mainType, mainDays] =
    [...byType.entries()].sort((a, b) => b[1].length - a[1].length || TYPE_ORDER.indexOf(a[0]) - TYPE_ORDER.indexOf(b[0]))[0]
  const useType = mainDays.length >= MIN_TIMED
  const pool = useType ? mainDays : timed.map((l) => l.days)
  const fastest = [...timed].sort((a, b) => a.days - b.days)[0]

  return {
    type: useType ? mainType : null,
    averageDays: Math.round(pool.reduce((a, b) => a + b, 0) / pool.length),
    count: pool.length,
    fastest,
  }
}

async function timeTravel(userId: string) {
  // Sólo obras terminadas: "del día en que la viste" no vale para una abandonada.
  const entries = await prisma.mediaEntry.findMany({
    where: { userId, year: { not: null }, status: { in: ['completed', 'mastered'] } },
    select: {
      title: true,
      type: true,
      year: true,
      createdAt: true,
      logs: { select: { startedAt: true, finishedAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  let best: { title: string; type: string; year: number; seenYear: number; years: number } | null = null
  for (const e of entries) {
    const log = e.logs[0]
    const seen = log?.finishedAt ?? log?.startedAt ?? e.createdAt
    const years = seen.getUTCFullYear() - e.year!
    if (years >= MIN_YEARS && (!best || years > best.years)) {
      best = { title: e.title, type: e.type, year: e.year!, seenYear: seen.getUTCFullYear(), years }
    }
  }
  return best
}

/** La obra que más veces terminó (sin contar abandonos). */
async function rewatch(userId: string) {
  const [top] = await prisma.logEntry.groupBy({
    by: ['entryId'],
    where: { userId, finishedAt: { not: null }, abandoned: false },
    _count: { _all: true },
    orderBy: { _count: { entryId: 'desc' } },
    take: 1,
  })
  if (!top || top._count._all < MIN_REWATCHES) return null
  const entry = await prisma.mediaEntry.findUnique({ where: { id: top.entryId }, select: { title: true, type: true } })
  return entry ? { ...entry, times: top._count._all } : null
}

type CollectionRow = { type: string; year: number | null; genres: string[]; rating: number | null; status: string; createdAt: Date }

/** El tipo que peor califica frente al que mejor (con al menos 2 notas en cada uno). */
function harsherWith(collection: CollectionRow[]) {
  const byType = new Map<string, number[]>()
  for (const e of collection) if (e.rating != null) byType.set(e.type, [...(byType.get(e.type) ?? []), e.rating])
  const averages = [...byType.entries()]
    .filter(([, r]) => r.length >= MIN_TYPE_RATINGS)
    .map(([type, r]) => ({ type, average: round1(r.reduce((a, b) => a + b, 0) / r.length), count: r.length }))
    .sort((a, b) => a.average - b.average)
  if (averages.length < 2) return null
  const strict = averages[0]
  const soft = averages[averages.length - 1]
  return soft.average - strict.average >= MIN_TYPE_GAP ? { strict, soft } : null
}

/** Qué parte de lo que registra salió en los últimos años. */
function era(collection: CollectionRow[]) {
  const years = collection.map((e) => e.year).filter((y): y is number => y != null)
  if (years.length < MIN_WITH_YEAR) return null
  const since = new Date().getFullYear() - RECENT_YEARS
  const recent = years.filter((y) => y >= since).length
  return { recentPercent: Math.round((recent / years.length) * 100), total: years.length, recentYears: RECENT_YEARS }
}

/** Cuántos géneros distintos cruza la colección y cuáles aparecieron por primera vez este año. */
function explorer(collection: CollectionRow[]) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1)
  const before = new Set<string>()
  const all = new Set<string>()
  for (const e of collection) {
    for (const g of e.genres) {
      all.add(g)
      if (e.createdAt < yearStart) before.add(g)
    }
  }
  if (all.size < MIN_GENRES) return null
  // Si todo se registró este año, no hay "nuevos": sería toda la colección.
  const newThisYear = before.size ? [...all].filter((g) => !before.has(g)).sort((a, b) => a.localeCompare(b, 'es')) : []
  return { genres: all.size, newThisYear }
}

/** Cuánto tardaría en vaciar su wishlist al ritmo del último año. */
function backlog(collection: CollectionRow[], finishedLastYear: number) {
  const pending = collection.filter((e) => e.status === 'want').length
  if (pending < MIN_BACKLOG) return null
  const perMonth = finishedLastYear / 12
  return { pending, months: perMonth > 0 ? Math.max(1, Math.ceil(pending / perMonth)) : null }
}

/**
 * La persona que sigue (con perfil público) con quien más obras comparte, y
 * qué tanto se parecen sus notas en las que calificaron los dos.
 */
async function affinity(userId: string) {
  const mine = await prisma.mediaEntry.findMany({
    where: { userId, externalId: { not: null } },
    select: { type: true, externalId: true, rating: true },
  })
  if (mine.length < MIN_SHARED) return null
  const follows = await prisma.follow.findMany({
    where: { followerId: userId, following: { profile: { isPublic: true } } },
    select: { following: { select: { id: true, name: true } } },
    take: 200,
  })
  if (!follows.length) return null

  const myRating = new Map(mine.map((m) => [`${m.type}|${m.externalId}`, m.rating]))
  const theirs = await prisma.mediaEntry.findMany({
    where: { userId: { in: follows.map((f) => f.following.id) }, externalId: { in: mine.map((m) => m.externalId!) } },
    select: { userId: true, type: true, externalId: true, rating: true },
  })
  const byPerson = new Map<string, { shared: number; gaps: number[] }>()
  for (const t of theirs) {
    const key = `${t.type}|${t.externalId}`
    if (!myRating.has(key)) continue
    const acc = byPerson.get(t.userId) ?? { shared: 0, gaps: [] }
    acc.shared++
    const mineR = myRating.get(key)
    if (mineR != null && t.rating != null) acc.gaps.push(Math.abs(mineR - t.rating))
    byPerson.set(t.userId, acc)
  }
  const [bestId, best] = [...byPerson.entries()].sort((a, b) => b[1].shared - a[1].shared)[0] ?? []
  if (!bestId || !best || best.shared < MIN_SHARED) return null
  const person = follows.find((f) => f.following.id === bestId)!.following
  return {
    name: person.name,
    shared: best.shared,
    /** Diferencia promedio de notas en las que calificaron los dos (null si ninguna). */
    ratingGap: best.gaps.length ? round1(best.gaps.reduce((a, b) => a + b, 0) / best.gaps.length) : null,
  }
}

export async function profileInsights(userId: string) {
  const yearAgo = new Date(Date.now() - 365 * DAY)
  const [collection, finishedLastYear] = await Promise.all([
    prisma.mediaEntry.findMany({
      where: { userId },
      select: { type: true, year: true, genres: true, rating: true, status: true, createdAt: true },
    }),
    prisma.logEntry.count({ where: { userId, finishedAt: { gte: yearAgo }, abandoned: false } }),
  ])
  const [against, pace, travel, again, shared] = await Promise.all([
    againstTheCurrent(userId),
    speed(userId),
    timeTravel(userId),
    rewatch(userId),
    affinity(userId),
  ])
  return {
    against,
    speed: pace,
    timeTravel: travel,
    rewatch: again,
    harsherWith: harsherWith(collection),
    era: era(collection),
    explorer: explorer(collection),
    backlog: backlog(collection, finishedLastYear),
    affinity: shared,
  }
}
