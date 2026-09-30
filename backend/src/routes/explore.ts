import { Hono } from 'hono'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { getSection, KINDS, SECTIONS, type SectionId } from '../lib/explore'
import type { MediaKind } from '../lib/externalSearch'

export const exploreRoutes = new Hono<AuthEnv>()

exploreRoutes.use('*', requireAuth)

/** País por defecto si el cliente no manda uno válido (igual que /details). */
const DEFAULT_REGION = 'MX'

// GET /explore/:section?type=all|movie|…&region=MX -> { items }
// Secciones: trending, upcoming, gems, community, foryou (ver lib/explore.ts).
exploreRoutes.get('/:section', async (c) => {
  const section = c.req.param('section') as SectionId
  if (!SECTIONS.includes(section)) return c.json({ message: 'Sección inválida.' }, 400)

  const typeParam = c.req.query('type') ?? 'all'
  const type = typeParam === 'all' || KINDS.includes(typeParam as MediaKind) ? (typeParam as MediaKind | 'all') : null
  if (!type) return c.json({ message: 'Tipo inválido.' }, 400)

  const regionParam = c.req.query('region')?.toUpperCase() ?? ''
  const region = /^[A-Z]{2}$/.test(regionParam) ? regionParam : DEFAULT_REGION

  const items = await getSection(section, type, { region, userId: c.get('userId') })
  return c.json({ items })
})
