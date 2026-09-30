import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'

export const profileRoutes = new Hono<AuthEnv>()

profileRoutes.use('*', requireAuth)

type ProfileRow = {
  handle: string
  avatar: string | null
  tagline: string
  quote: string
  memberSince: number | null
  isPublic: boolean
  topPicks: string[]
}

/** Shape que espera el frontend (`UserProfile`): el `name` vive en User. */
function toProfileDTO(p: ProfileRow, name: string) {
  return {
    name,
    handle: p.handle,
    avatar: p.avatar,
    tagline: p.tagline,
    quote: p.quote,
    memberSince: p.memberSince,
    isPublic: p.isPublic,
    topPicks: p.topPicks,
  }
}

const MAX_TOP_PICKS = 4

/**
 * "Tus 4 favoritas": ids de obras del propio usuario, sin repetir, en orden.
 * Devuelve null si el valor no es una lista válida.
 */
async function readTopPicks(value: unknown, userId: string): Promise<string[] | null> {
  if (!Array.isArray(value)) return null
  const ids = [...new Set(value.filter((v): v is string => typeof v === 'string'))]
  if (ids.length !== value.length || ids.length > MAX_TOP_PICKS) return null
  const owned = await prisma.mediaEntry.count({ where: { id: { in: ids }, userId } })
  return owned === ids.length ? ids : null
}

const WRITABLE = ['handle', 'avatar', 'tagline', 'quote', 'memberSince', 'isPublic'] as const

function pickProfileFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  for (const key of WRITABLE) {
    if (key in body && body[key] !== undefined) data[key] = body[key]
  }
  return data
}

// GET /profile -> UserProfile
profileRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } })
  if (!user) return c.json({ message: 'No autorizado.' }, 401)

  const profile = user.profile ?? (await prisma.profile.create({ data: { userId } }))
  return c.json(toProfileDTO(profile, user.name))
})

// PATCH /profile  (Partial<UserProfile>) -> UserProfile
profileRoutes.patch('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  if (typeof body.name === 'string' && body.name.trim()) {
    await prisma.user.update({ where: { id: userId }, data: { name: body.name.trim() } })
  }

  const fields = pickProfileFields(body)
  if ('topPicks' in body) {
    const topPicks = await readTopPicks(body.topPicks, userId)
    if (!topPicks) return c.json({ message: 'Elige hasta 4 obras distintas de tu colección.' }, 400)
    fields.topPicks = topPicks
  }
  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  return c.json(toProfileDTO(profile, user!.name))
})
