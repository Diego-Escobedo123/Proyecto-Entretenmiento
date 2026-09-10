import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { hashPassword, signToken, verifyPassword } from '../lib/auth'
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

// GET /auth/me   (requiere token) -> usuario actual
authRoutes.get('/me', requireAuth, async (c) => {
  const user = await prisma.user.findUnique({ where: { id: c.get('userId') } })
  if (!user) return c.json({ message: 'No autorizado.' }, 401)
  return c.json({ user: publicUser(user) })
})
