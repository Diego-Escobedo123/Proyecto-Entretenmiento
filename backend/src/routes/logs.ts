import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { createLog, parseDay, toLogDTO } from '../lib/logs'
import { validateBody } from '../lib/validation'
import { createLogSchema, updateLogSchema } from '../lib/schemas'

export const logRoutes = new Hono<AuthEnv>()

logRoutes.use('*', requireAuth)

const ENTRY_FIELDS = {
  id: true,
  type: true,
  title: true,
  creator: true,
  cover: true,
  externalId: true,
  genres: true,
  year: true,
} as const

/** Día de la entrada para ordenar: cuándo terminó o, si sigue en curso, cuándo empezó. */
const dayOf = (log: { startedAt: Date | null; finishedAt: Date | null; createdAt: Date }) =>
  (log.finishedAt ?? log.startedAt ?? log.createdAt).getTime()

function ratingOf(value: unknown): number | null {
  return typeof value === 'number' && value > 0 && value <= 5 ? Math.round(value * 2) / 2 : null
}

// GET /logs?entryId=... -> LogEntry[] (más reciente primero), con los datos de la obra.
logRoutes.get('/', async (c) => {
  const entryId = c.req.query('entryId')
  const rows = await prisma.logEntry.findMany({
    where: { userId: c.get('userId'), ...(entryId && { entryId }) },
    include: { entry: { select: ENTRY_FIELDS } },
  })
  rows.sort((a, b) => dayOf(b) - dayOf(a) || b.createdAt.getTime() - a.createdAt.getTime())
  return c.json(rows.map(toLogDTO))
})

// POST /logs { entryId, startedAt?, finishedAt?, rating? } -> LogEntry
// Registrar otra vez una obra ("volver a verla"); se marca como repetición sola.
logRoutes.post('/', async (c) => {
  const parsed = await validateBody(c, createLogSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const entry = await prisma.mediaEntry.findFirst({
    where: { id: body.entryId, userId: c.get('userId') },
  })
  if (!entry) return c.json({ message: 'No existe la obra.' }, 404)

  const startedAt = parseDay(body.startedAt)
  let finishedAt = parseDay(body.finishedAt)
  if (!startedAt && !finishedAt) finishedAt = new Date(new Date().toISOString().slice(0, 10))

  const rating = ratingOf(body.rating)
  const row = await createLog(entry, { startedAt, finishedAt, rating })
  // Como en Letterboxd: la calificación de la obra es la del último visionado.
  if (finishedAt && rating != null) {
    await prisma.mediaEntry.update({ where: { id: entry.id }, data: { rating } })
  }
  return c.json(toLogDTO(row), 201)
})

// PATCH /logs/:id { startedAt?, finishedAt?, rating?, abandoned? } -> LogEntry
logRoutes.patch('/:id', async (c) => {
  const owned = await prisma.logEntry.findFirst({ where: { id: c.req.param('id'), userId: c.get('userId') } })
  if (!owned) return c.json({ message: 'No existe esa entrada del diario.' }, 404)

  const parsed = await validateBody(c, updateLogSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const data: Record<string, unknown> = {}
  if ('startedAt' in body) data.startedAt = parseDay(body.startedAt)
  if ('finishedAt' in body) data.finishedAt = parseDay(body.finishedAt)
  if ('rating' in body) data.rating = ratingOf(body.rating)
  if (body.abandoned !== undefined) data.abandoned = body.abandoned

  const row = await prisma.logEntry.update({ where: { id: owned.id }, data })
  return c.json(toLogDTO(row))
})

// DELETE /logs/:id -> 204
logRoutes.delete('/:id', async (c) => {
  const owned = await prisma.logEntry.findFirst({ where: { id: c.req.param('id'), userId: c.get('userId') } })
  if (!owned) return c.json({ message: 'No existe esa entrada del diario.' }, 404)
  await prisma.logEntry.delete({ where: { id: owned.id } })
  return c.body(null, 204)
})