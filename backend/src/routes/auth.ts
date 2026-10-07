import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { hashPassword, isGoogleAuthEnabled, signToken, verifyGoogleIdToken, verifyPassword } from '../lib/auth'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { validateBody } from '../lib/validation'
import { googleLoginSchema, loginSchema, registerSchema } from '../lib/schemas'

export const authRoutes = new Hono<AuthEnv>()

function publicUser(user: { id: string; name: string; email: string }) {
  return { id: user.id, name: user.name, email: user.email }
}

// POST /auth/register  { name, email, password }
authRoutes.post('/register', async (c) => {
  const parsed = await validateBody(c, registerSchema)
  if (!parsed.ok) return parsed.response
  const { name, email, password } = parsed.data

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return c.json({ message: 'Ese correo ya está registrado.' }, 409)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      profile: {
        create: { handle: email.split('@')[0], memberSince: new Date().getFullYear() },
      },
    },
  })

  return c.json({ token: await signToken(user.id), user: publicUser(user) }, 201)
})

// POST /auth/login  { email, password }
authRoutes.post('/login', async (c) => {
  const parsed = await validateBody(c, loginSchema)
  if (!parsed.ok) return parsed.response
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })
  const ok = user ? await verifyPassword(password, user.passwordHash) : false
  if (!user || !ok) return c.json({ message: 'Correo o contraseña incorrectos.' }, 401)

  return c.json({ token: await signToken(user.id), user: publicUser(user) })
})

// POST /auth/google  { idToken }  (ID token del botón de Google Identity Services)
authRoutes.post('/google', async (c) => {
  if (!isGoogleAuthEnabled()) {
    return c.json({ message: 'El inicio con Google no está configurado en el servidor.' }, 503)
  }

  const parsed = await validateBody(c, googleLoginSchema)
  if (!parsed.ok) return parsed.response
  const { idToken } = parsed.data

  const google = await verifyGoogleIdToken(idToken)
  if (!google) return c.json({ message: 'No se pudo verificar la cuenta de Google.' }, 401)

  // Si ya existe una cuenta con ese correo, entra a esa misma cuenta.
  // Si no, se crea con una contraseña aleatoria: solo podrá entrar con Google.
  const user =
    (await prisma.user.findUnique({ where: { email: google.email } })) ??
    (await prisma.user.create({
      data: {
        name: google.name,
        email: google.email,
        passwordHash: await hashPassword(crypto.randomUUID()),
        profile: {
          create: { handle: google.email.split('@')[0], memberSince: new Date().getFullYear() },
        },
      },
    }))

  return c.json({ token: await signToken(user.id), user: publicUser(user) })
})

// GET /auth/me   (requiere token) -> usuario actual
authRoutes.get('/me', requireAuth, async (c) => {
  const user = await prisma.user.findUnique({ where: { id: c.get('userId') } })
  if (!user) return c.json({ message: 'No autorizado.' }, 401)
  return c.json({ user: publicUser(user) })
})