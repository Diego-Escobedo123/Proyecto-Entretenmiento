import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { validateBody } from '../lib/validation'
import { createGoalSchema } from '../lib/schemas'

export const goalRoutes = new Hono<AuthEnv>()

goalRoutes.use('*', requireAuth)

const toGoalDTO = (g: { id: string; year: number; type: string; target: number }) => ({
  id: g.id,
  year: g.year,
  type: g.type,
  target: g.target,
})

// GET /goals?year=2026 -> Goal[]  (sin year: todas)
goalRoutes.get('/', async (c) => {
  const year = Number(c.req.query('year'))
  const rows = await prisma.goal.findMany({
    where: { userId: c.get('userId'), ...(Number.isInteger(year) && year > 0 && { year }) },
    orderBy: [{ year: 'desc' }, { type: 'asc' }],
  })
  return c.json(rows.map(toGoalDTO))
})

// POST /goals { year, type, target } -> Goal   (crea o cambia la meta de ese año y tipo)
goalRoutes.post('/', async (c) => {
  const parsed = await validateBody(c, createGoalSchema)
  if (!parsed.ok) return parsed.response
  const { year, type, target } = parsed.data

  const userId = c.get('userId')
  const row = await prisma.goal.upsert({
    where: { userId_year_type: { userId, year, type } },
    create: { userId, year, type, target },
    update: { target },
  })
  return c.json(toGoalDTO(row))
})

// DELETE /goals/:id -> 204
goalRoutes.delete('/:id', async (c) => {
  const owned = await prisma.goal.findFirst({ where: { id: c.req.param('id'), userId: c.get('userId') } })
  if (!owned) return c.json({ message: 'No existe esa meta.' }, 404)
  await prisma.goal.delete({ where: { id: owned.id } })
  return c.body(null, 204)
})