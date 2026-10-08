import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { fromMediaInput, toMediaDTO } from '../lib/serialize'
import { parseDay, recordStatusChange, syncLatestRating } from '../lib/logs'
import { validateBody } from '../lib/validation'
import { checkGoalsCompleted } from '../lib/notifications'
import { createMediaSchema, updateMediaSchema } from '../lib/schemas'

/**
 * Día que el usuario eligió para el cambio de estado (`logDate`, "2026-09-29").
 * No es un campo de la obra: sólo alimenta el diario. Por defecto, hoy (UTC).
 */
function logDay(body: Record<string, unknown>): Date {
  return parseDay(body.logDate) ?? new Date(new Date().toISOString().slice(0, 10))
}

/**
 * Cuándo la empezó (`startDate`), si la está terminando o abandonando y lo
 * indicó. Error si es posterior al día del cambio.
 */
function startDay(body: Record<string, unknown>): { day: Date | null } | { error: string } {
  const day = parseDay(body.startDate)
  if (day && day > logDay(body)) return { error: 'La fecha de inicio no puede ser posterior a la de finalización.' }
  return { day }
}

export const mediaRoutes = new Hono<AuthEnv>()

// Todo /media requiere estar autenticado.
mediaRoutes.use('*', requireAuth)

/** Devuelve la obra si existe y es del usuario; si no, null. */
async function findOwned(id: string, userId: string) {
  return prisma.mediaEntry.findFirst({ where: { id, userId } })
}

// GET /media -> MediaEntry[]  (más reciente primero)
mediaRoutes.get('/', async (c) => {
  const rows = await prisma.mediaEntry.findMany({
    where: { userId: c.get('userId') },
    orderBy: { updatedAt: 'desc' },
  })
  return c.json(rows.map(toMediaDTO))
})

// GET /media/:id -> MediaEntry
mediaRoutes.get('/:id', async (c) => {
  const row = await findOwned(c.req.param('id'), c.get('userId'))
  if (!row) return c.json({ message: 'No existe la obra.' }, 404)
  return c.json(toMediaDTO(row))
})

// POST /media  (MediaEntryInput) -> MediaEntry
mediaRoutes.post('/', async (c) => {
  const parsed = await validateBody(c, createMediaSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const start = startDay(body)
  if ('error' in start) return c.json({ field: 'startDate', message: start.error }, 400)

  const row = await prisma.mediaEntry.create({
    data: { ...fromMediaInput(body), userId: c.get('userId') } as never,
  })
  await recordStatusChange(row, null, logDay(body), start.day)
  await checkGoalsCompleted(row.userId)
  return c.json(toMediaDTO(row), 201)
})

// PATCH /media/:id  (Partial<MediaEntryInput>) -> MediaEntry
mediaRoutes.patch('/:id', async (c) => {
  const owned = await findOwned(c.req.param('id'), c.get('userId'))
  if (!owned) return c.json({ message: 'No existe la obra.' }, 404)

  const parsed = await validateBody(c, updateMediaSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const start = startDay(body)
  if ('error' in start) return c.json({ field: 'startDate', message: start.error }, 400)
  const row = await prisma.mediaEntry.update({
    where: { id: owned.id },
    data: fromMediaInput(body),
  })
  if (row.status !== owned.status) {
    await recordStatusChange(row, owned.status, logDay(body), start.day)
    await checkGoalsCompleted(row.userId)
  } else if (row.rating !== owned.rating) await syncLatestRating(row)
  return c.json(toMediaDTO(row))
})

// DELETE /media/:id -> 204
mediaRoutes.delete('/:id', async (c) => {
  const owned = await findOwned(c.req.param('id'), c.get('userId'))
  if (!owned) return c.json({ message: 'No existe la obra.' }, 404)

  await prisma.mediaEntry.delete({ where: { id: owned.id } })
  return c.body(null, 204)
})