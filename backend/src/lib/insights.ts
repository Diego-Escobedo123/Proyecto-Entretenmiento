/**
 * Insights del perfil que necesitan datos de fuera del ADN (el diario
 * completo o las notas de los demás). Cada uno es `null` cuando no hay datos
 * suficientes para decir algo interesante; el frontend elige los 3 más
 * llamativos entre estos y los que calcula por su cuenta.
 *
 * - against:    la obra donde su nota más se aleja del promedio de Mosaic.
 * - speed:      cuánto tarda en terminar algo (y su récord).
 * - timeTravel: la obra más vieja respecto de cuándo la vio.
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

export async function profileInsights(userId: string) {
  const [against, pace, travel] = await Promise.all([againstTheCurrent(userId), speed(userId), timeTravel(userId)])
  return { against, speed: pace, timeTravel: travel }
}
