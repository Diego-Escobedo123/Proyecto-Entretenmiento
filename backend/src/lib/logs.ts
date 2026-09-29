/**
 * Diario: cada vez que el usuario ve/lee/juega/escucha una obra. Las entradas
 * se crean solas al cambiar el estado de la obra (empezarla, terminarla,
 * abandonarla) y también a mano ("volver a verla").
 */
import type { LogEntry, MediaEntry } from '@prisma/client'
import { prisma } from './prisma'
import { upgradeBookCover } from './externalSearch'

const FINISHED = new Set(['completed', 'mastered'])

/** "2026-09-29" -> Date a medianoche UTC (columna DATE). Cualquier otra cosa -> null. */
export function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDay = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null)

type LogWithEntry = LogEntry & {
  entry?: Pick<MediaEntry, 'id' | 'type' | 'title' | 'creator' | 'cover' | 'externalId' | 'genres' | 'year'>
}

export function toLogDTO(row: LogWithEntry) {
  return {
    id: row.id,
    entryId: row.entryId,
    startedAt: formatDay(row.startedAt),
    finishedAt: formatDay(row.finishedAt),
    rating: row.rating,
    repeat: row.repeat,
    abandoned: row.abandoned,
    createdAt: row.createdAt.toISOString(),
    ...(row.entry && {
      entry: { ...row.entry, cover: upgradeBookCover(row.entry.cover) },
    }),
  }
}

/** Ya la terminó alguna vez: una entrada nueva es "volver a verla/leerla". */
async function hasFinishedBefore(entryId: string): Promise<boolean> {
  const count = await prisma.logEntry.count({ where: { entryId, finishedAt: { not: null }, abandoned: false } })
  return count > 0
}

export async function createLog(
  entry: Pick<MediaEntry, 'id' | 'userId'>,
  data: { startedAt?: Date | null; finishedAt?: Date | null; rating?: number | null; abandoned?: boolean },
) {
  return prisma.logEntry.create({
    data: {
      userId: entry.userId,
      entryId: entry.id,
      startedAt: data.startedAt ?? null,
      finishedAt: data.finishedAt ?? null,
      rating: data.rating ?? null,
      abandoned: data.abandoned ?? false,
      repeat: await hasFinishedBefore(entry.id),
    },
  })
}

/**
 * Refleja en el diario un cambio de estado de la obra. `prev` es null en un
 * alta. `day` es la fecha que eligió el usuario (hoy por defecto).
 *
 * - → en progreso: abre una entrada (si no hay una abierta).
 * - → terminada/100%: cierra la abierta o crea una ya terminada.
 *   (terminada → 100% es el mismo recorrido: no crea otra.)
 * - → abandonada: cierra la abierta marcándola como abandonada.
 * - → pendiente: nada; el historial se conserva.
 */
export async function recordStatusChange(entry: MediaEntry, prev: string | null, day: Date) {
  const next = entry.status
  if (prev === next) return
  if (next === 'want') return
  if (FINISHED.has(next) && prev != null && FINISHED.has(prev)) return

  const open = await prisma.logEntry.findFirst({
    where: { entryId: entry.id, finishedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (next === 'in-progress') {
    if (!open) await createLog(entry, { startedAt: day })
    return
  }

  const closing = FINISHED.has(next)
    ? { finishedAt: day, rating: entry.rating, abandoned: false }
    : { finishedAt: day, rating: null, abandoned: true }

  if (open) await prisma.logEntry.update({ where: { id: open.id }, data: closing })
  else await createLog(entry, closing)
}

/** La calificación de la obra es la de su último visionado/lectura terminado. */
export async function syncLatestRating(entry: MediaEntry) {
  if (!FINISHED.has(entry.status)) return
  const latest = await prisma.logEntry.findFirst({
    where: { entryId: entry.id, finishedAt: { not: null }, abandoned: false },
    orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
  })
  if (latest && latest.rating !== entry.rating) {
    await prisma.logEntry.update({ where: { id: latest.id }, data: { rating: entry.rating } })
  }
}
