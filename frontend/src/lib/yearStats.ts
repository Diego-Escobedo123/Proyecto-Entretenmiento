/**
 * Resumen de un año a partir del diario (como el Year in Review de
 * Letterboxd): qué se terminó, cuánto, cuándo y qué gustó más.
 */
import type { LogEntry } from '../types/log'
import type { MediaEntry, MediaType } from '../types/media'

/** Terminada (no abandonada) dentro del año. */
export function finishedIn(logs: LogEntry[], year: number): LogEntry[] {
  return logs.filter((l) => l.entry && l.finishedAt && !l.abandoned && Number(l.finishedAt.slice(0, 4)) === year)
}

/** Avance de una meta del reto: obras terminadas ese año, del tipo o de cualquiera. */
export function goalProgress(logs: LogEntry[], year: number, type: MediaType | 'all'): number {
  return finishedIn(logs, year).filter((l) => type === 'all' || l.entry!.type === type).length
}

export interface YearStats {
  total: number
  byType: Record<MediaType, number>
  /** Veces que se volvió a ver/leer algo. */
  repeats: number
  abandoned: number
  averageRating: number | null
  /** Páginas de los libros terminados (según el total registrado en cada uno). */
  pages: number
  /** Horas de los juegos terminados. */
  hours: number
  /** Terminadas por mes, enero = 0. */
  perMonth: number[]
  topGenres: { name: string; count: number }[]
  topRated: { log: LogEntry; rating: number }[]
}

export function yearStats(logs: LogEntry[], year: number, entries: MediaEntry[]): YearStats {
  const done = finishedIn(logs, year)
  const byId = new Map(entries.map((e) => [e.id, e]))

  const byType: Record<MediaType, number> = { movie: 0, series: 0, book: 0, game: 0, music: 0 }
  const perMonth = Array.from({ length: 12 }, () => 0)
  const genres = new Map<string, number>()
  let pages = 0
  let hours = 0

  for (const log of done) {
    const type = log.entry!.type
    byType[type]++
    perMonth[Number(log.finishedAt!.slice(5, 7)) - 1]++
    for (const g of log.entry!.genres) genres.set(g, (genres.get(g) ?? 0) + 1)
    const entry = byId.get(log.entryId)
    if (type === 'book') pages += entry?.pagesTotal ?? 0
    if (type === 'game') hours += entry?.hoursPlayed ?? 0
  }

  const rated = done.filter((l) => l.rating != null)
  const averageRating = rated.length ? rated.reduce((sum, l) => sum + l.rating!, 0) / rated.length : null

  // Una obra vista dos veces aparece una sola vez: con su mejor calificación.
  const bestByWork = new Map<string, { log: LogEntry; rating: number }>()
  for (const log of rated) {
    const prev = bestByWork.get(log.entryId)
    if (!prev || log.rating! > prev.rating) bestByWork.set(log.entryId, { log, rating: log.rating! })
  }

  return {
    total: done.length,
    byType,
    repeats: done.filter((l) => l.repeat).length,
    abandoned: logs.filter((l) => l.abandoned && l.finishedAt && Number(l.finishedAt.slice(0, 4)) === year).length,
    averageRating,
    pages,
    hours,
    perMonth,
    topGenres: [...genres.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    topRated: [...bestByWork.values()].sort((a, b) => b.rating - a.rating).slice(0, 5),
  }
}
