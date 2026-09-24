import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { toPublicEntryDTO, toPublicUserDTO } from '../lib/serialize'

export const userRoutes = new Hono<AuthEnv>()

userRoutes.use('*', requireAuth)

const MAX_ENTRIES = 60

/**
 * GET /users/:id (o /users/me) -> perfil público de un usuario
 *   { user, tagline, quote, isPublic, isSelf, entries }
 *
 * Si el perfil es privado (`Profile.isPublic = false`) y no es el propio,
 * `entries` viene vacío: sólo se muestran los datos básicos. Las notas de
 * cada obra sólo se incluyen si el dueño las marcó como públicas.
 */
userRoutes.get('/:id', async (c) => {
  // `/users/me` = cómo ven los demás el perfil propio.
  const id = c.req.param('id') === 'me' ? c.get('userId') : c.req.param('id')
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      profile: { select: { handle: true, avatar: true, tagline: true, quote: true, isPublic: true } },
    },
  })
  if (!user) return c.json({ message: 'No existe el usuario.' }, 404)

  const isSelf = id === c.get('userId')
  const isPublic = user.profile?.isPublic ?? false

  const entries =
    isPublic || isSelf
      ? await prisma.mediaEntry.findMany({
          where: { userId: id },
          orderBy: { updatedAt: 'desc' },
          take: MAX_ENTRIES,
        })
      : []

  return c.json({
    user: toPublicUserDTO(user),
    tagline: user.profile?.tagline ?? '',
    quote: user.profile?.quote ?? '',
    isPublic,
    isSelf,
    entries: entries.map(toPublicEntryDTO),
  })
})
