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

const MAX_TOP_PICKS = 5

/**
 * "Tus 5 favoritas": ids de obras del propio usuario, sin repetir, en orden.
 * Devuelve null si el valor no es una lista válida.
 */
async function readTopPicks(value: unknown, userId: string): Promise<string[] | null> {
  if (!Array.isArray(value)) return null
  const ids = [...new Set(value.filter((v): v is string => typeof v === 'string'))]
  if (ids.length !== value.length || ids.length > MAX_TOP_PICKS) return null
  const owned = await prisma.mediaEntry.count({ where: { id: { in: ids }, userId } })
  return owned === ids.length ? ids : null
}

// Límites de "Ajustes del perfil" (los mismos que muestra el formulario).
const MAX_NAME = 40
const MAX_TAGLINE = 60
const MAX_QUOTE = 120
/** Usuario: minúsculas, números, punto y guion bajo; de 3 a 30. */
const HANDLE_RE = /^[a-z0-9._]{3,30}$/
const MAX_AVATAR_URL = 500
/** Foto subida: el navegador la recorta a 256 × 256 (unos 20–40 KB); esto deja margen. */
const MAX_AVATAR_DATA = 200_000
const AVATAR_DATA_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/

/** Error de un campo; `status` 409 cuando el valor ya lo usa otra persona. */
type FieldError = { message: string; field: string; status?: 400 | 409 }

/** Comillas que haya escrito la persona alrededor de la cita: las pone el perfil. */
const stripQuotes = (text: string) => text.trim().replace(/^["“”'«»]+|["“”'«»]+$/g, '').trim()

/**
 * Lee y valida los campos editables del perfil que vengan en el body.
 * Devuelve los datos listos para guardar o el primer error, con su campo.
 */
async function readProfileFields(
  body: Record<string, unknown>,
  userId: string,
): Promise<{ data: Record<string, unknown> } | { error: FieldError }> {
  const data: Record<string, unknown> = {}

  if ('handle' in body) {
    const handle = String(body.handle ?? '').trim().replace(/^@/, '').toLowerCase()
    if (!HANDLE_RE.test(handle)) {
      return { error: { field: 'handle', message: 'De 3 a 30 caracteres: letras, números, punto o guion bajo.' } }
    }
    const taken = await prisma.profile.count({ where: { handle, userId: { not: userId } } })
    if (taken) return { error: { field: 'handle', message: 'Ese usuario ya está en uso.', status: 409 } }
    data.handle = handle
  }

  if ('tagline' in body) {
    const tagline = String(body.tagline ?? '').trim()
    if (tagline.length > MAX_TAGLINE) return { error: { field: 'tagline', message: `Hasta ${MAX_TAGLINE} caracteres.` } }
    data.tagline = tagline
  }

  if ('quote' in body) {
    const quote = stripQuotes(String(body.quote ?? ''))
    if (quote.length > MAX_QUOTE) return { error: { field: 'quote', message: `Hasta ${MAX_QUOTE} caracteres.` } }
    data.quote = quote
  }

  if ('avatar' in body) {
    const avatar = body.avatar == null ? '' : String(body.avatar).trim()
    if (!avatar) data.avatar = null
    else if (avatar.startsWith('data:')) {
      if (avatar.length > MAX_AVATAR_DATA || !AVATAR_DATA_RE.test(avatar)) {
        return { error: { field: 'avatar', message: 'La foto no es válida o es demasiado pesada.' } }
      }
      data.avatar = avatar
    } else {
      if (avatar.length > MAX_AVATAR_URL || !/^https?:\/\/\S+$/i.test(avatar)) {
        return { error: { field: 'avatar', message: 'El enlace debe empezar con http:// o https://.' } }
      }
      data.avatar = avatar
    }
  }

  if ('isPublic' in body) data.isPublic = Boolean(body.isPublic)
  if ('memberSince' in body) {
    const year = Number(body.memberSince)
    data.memberSince = Number.isInteger(year) && year > 2000 && year <= new Date().getFullYear() ? year : null
  }

  return { data }
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

  if ('name' in body) {
    const name = String(body.name ?? '').trim()
    if (!name || name.length > MAX_NAME) {
      return c.json({ field: 'name', message: `Escribe un nombre de hasta ${MAX_NAME} caracteres.` }, 400)
    }
  }

  const read = await readProfileFields(body, userId)
  if ('error' in read) {
    const { status = 400, ...error } = read.error
    return c.json(error, status)
  }
  const fields = read.data

  // El nombre recién después de validar todo: si algo falla, no se guarda nada a medias.
  if ('name' in body) {
    await prisma.user.update({ where: { id: userId }, data: { name: String(body.name).trim() } })
  }
  if ('topPicks' in body) {
    const topPicks = await readTopPicks(body.topPicks, userId)
    if (!topPicks) return c.json({ message: 'Elige hasta 5 obras distintas de tu colección.' }, 400)
    fields.topPicks = topPicks
  }
  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  })

  // Si la cuenta pasa a pública, las solicitudes pendientes se aceptan solas.
  if (fields.isPublic === true) {
    const pending = await prisma.followRequest.findMany({ where: { targetId: userId }, select: { requesterId: true } })
    if (pending.length) {
      await prisma.$transaction([
        prisma.follow.createMany({
          data: pending.map((r) => ({ followerId: r.requesterId, followingId: userId })),
          skipDuplicates: true,
        }),
        prisma.followRequest.deleteMany({ where: { targetId: userId } }),
      ])
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  return c.json(toProfileDTO(profile, user!.name))
})
