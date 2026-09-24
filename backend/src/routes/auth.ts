import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { hashPassword, isGoogleAuthEnabled, signToken, verifyGoogleIdToken, verifyPassword } from '../lib/auth'
import { requireAuth, type AuthEnv } from '../middleware/auth'

export const authRoutes = new Hono<AuthEnv>()

function publicUser(user: { id: string; name: string; email: string }) {
  return { id: user.id, name: user.name, email: user.email }
}

// POST /auth/register  { name, email, password }
authRoutes.post('/register', async (c) => {
  const { name, email, password } = await c.req.json().catch(() => ({}))

  if (!name?.trim()) return c.json({ message: 'Ingresa tu nombre.' }, 400)
  if (typeof email !== 'string' || !email.includes('@')) {
    return c.json({ message: 'Ingresa un correo válido.' }, 400)
  }
  if (typeof password !== 'string' || password.length < 6) {
    return c.json({ message: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return c.json({ message: 'Ese correo ya está registrado.' }, 409)

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
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
  const { email, password } = await c.req.json().catch(() => ({}))

  const user = typeof email === 'string' ? await prisma.user.findUnique({ where: { email } }) : null
  const ok = user ? await verifyPassword(String(password ?? ''), user.passwordHash) : false
  if (!user || !ok) return c.json({ message: 'Correo o contraseña incorrectos.' }, 401)

  return c.json({ token: await signToken(user.id), user: publicUser(user) })
})

// POST /auth/google  { idToken }  (ID token del botón de Google Identity Services)
authRoutes.post('/google', async (c) => {
  if (!isGoogleAuthEnabled()) {
    return c.json({ message: 'El inicio con Google no está configurado en el servidor.' }, 503)
  }

  const { idToken } = await c.req.json().catch(() => ({}))
  if (typeof idToken !== 'string' || !idToken) return c.json({ message: 'Falta el token de Google.' }, 400)

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
