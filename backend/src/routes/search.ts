import { Hono } from 'hono'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { searchExternal } from '../lib/externalSearch'

export const searchRoutes = new Hono<AuthEnv>()

searchRoutes.use('*', requireAuth)

const VALID_TYPES = new Set(['movie', 'book', 'game', 'music'])

// GET /search?type=movie&q=dune -> { available, results }
searchRoutes.get('/', async (c) => {
  const type = c.req.query('type') ?? ''
  const q = c.req.query('q')?.trim() ?? ''

  if (!VALID_TYPES.has(type)) {
    return c.json({ message: 'Tipo inválido. Usa movie, book, game o music.' }, 400)
  }
  if (q.length < 2) return c.json({ available: true, results: [] })

  try {
    const response = await searchExternal(type, q)
    return c.json(response)
  } catch (err) {
    console.error(`search/${type}:`, err)
    return c.json({ message: 'No se pudo buscar en la fuente externa.' }, 502)
  }
})
