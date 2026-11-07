import { Hono } from 'hono'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { getWorkDetails } from '../lib/workDetails'

export const detailsRoutes = new Hono<AuthEnv>()

detailsRoutes.use('*', requireAuth)

/** País por defecto si el cliente no manda uno válido. */
const DEFAULT_REGION = 'MX'

// GET /details?externalId=tmdb-tv:1396&region=MX -> WorkDetails | null
detailsRoutes.get('/', async (c) => {
  const externalId = c.req.query('externalId')?.trim() ?? ''
  if (!externalId) return c.json({ message: 'Falta externalId.' }, 400)

  const regionParam = c.req.query('region')?.toUpperCase() ?? ''
  const region = /^[A-Z]{2}$/.test(regionParam) ? regionParam : DEFAULT_REGION

  try {
    return c.json(await getWorkDetails(externalId, region))
  } catch (err) {
    console.error(`details/${externalId}:`, err)
    return c.json({ message: 'No se pudo obtener la ficha de la obra.' }, 502)
  }
})
