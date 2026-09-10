import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { fromMediaInput, toMediaDTO } from '../lib/serialize'

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
  const body = await c.req.json().catch(() => ({}))
  if (typeof body.title !== 'string' || !body.title.trim()) {
    return c.json({ message: 'El título es obligatorio.' }, 400)
  }
  if (typeof body.type !== 'string' || !body.type) {
    return c.json({ message: 'El tipo es obligatorio.' }, 400)
  }

  const row = await prisma.mediaEntry.create({
    data: { ...fromMediaInput(body), userId: c.get('userId') } as never,
  })
  return c.json(toMediaDTO(row), 201)
})

// PATCH /media/:id  (Partial<MediaEntryInput>) -> MediaEntry
mediaRoutes.patch('/:id', async (c) => {
  const owned = await findOwned(c.req.param('id'), c.get('userId'))
  if (!owned) return c.json({ message: 'No existe la obra.' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const row = await prisma.mediaEntry.update({
    where: { id: owned.id },
    data: fromMediaInput(body),
  })
  return c.json(toMediaDTO(row))
})

// DELETE /media/:id -> 204
mediaRoutes.delete('/:id', async (c) => {
  const owned = await findOwned(c.req.param('id'), c.get('userId'))
  if (!owned) return c.json({ message: 'No existe la obra.' }, 404)

  await prisma.mediaEntry.delete({ where: { id: owned.id } })
  return c.body(null, 204)
})
