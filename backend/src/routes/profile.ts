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
  }
}

const WRITABLE = ['handle', 'avatar', 'tagline', 'quote', 'memberSince'] as const

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
  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  return c.json(toProfileDTO(profile, user!.name))
})
