import { Hono } from 'hono'
import type { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { hashPassword, isGoogleAuthEnabled, signToken, verifyGoogleIdToken, verifyPassword } from '../lib/auth'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { validateBody } from '../lib/validation'
import { googleLoginSchema, loginSchema, registerSchema, verifyEmailSchema } from '../lib/schemas'
import { resendWaitMs, sendVerificationEmail, verifyEmailToken } from '../lib/emailVerification'

export const authRoutes = new Hono<AuthEnv>()

function publicUser(user: { id: string; name: string; email: string; role: Role; emailVerifiedAt: Date | null }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
  }
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

  // No frena el registro: si Resend falla, el usuario puede pedir otro correo desde la app.
  void sendVerificationEmail(user).catch((err) => console.error('No se pudo enviar el correo de verificación:', err))

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
  // Google ya comprobó el correo (verifyGoogleIdToken exige email_verified),
  // así que la cuenta queda verificada en ambos casos.
  const existing = await prisma.user.findUnique({ where: { email: google.email } })
  let user
  if (!existing) {
    user = await prisma.user.create({
      data: {
        name: google.name,
        email: google.email,
        emailVerifiedAt: new Date(),
        passwordHash: await hashPassword(crypto.randomUUID()),
        profile: {
          create: { handle: google.email.split('@')[0], memberSince: new Date().getFullYear() },
        },
      },
    })
  } else if (!existing.emailVerifiedAt) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: { emailVerifiedAt: new Date(), emailVerifyTokenHash: null, emailVerifyTokenExpiresAt: null },
    })
  } else {
    user = existing
  }

  // isNew: la cuenta se acaba de crear (el frontend lo cuenta como registro en la analítica).
  return c.json({ token: await signToken(user.id), user: publicUser(user), isNew: !existing })
})

// GET /auth/me   (requiere token) -> usuario actual
authRoutes.get('/me', requireAuth, async (c) => {
  const user = await prisma.user.findUnique({ where: { id: c.get('userId') } })
  if (!user) return c.json({ message: 'No autorizado.' }, 401)
  return c.json({ user: publicUser(user) })
})

// POST /auth/verify-email  { token }  (token del enlace del correo; no pide sesión)
authRoutes.post('/verify-email', async (c) => {
  const parsed = await validateBody(c, verifyEmailSchema)
  if (!parsed.ok) return parsed.response

  const user = await verifyEmailToken(parsed.data.token)
  if (!user) return c.json({ message: 'El enlace no es válido o ya caducó. Pide uno nuevo desde la app.' }, 400)
  return c.json({ user: publicUser(user) })
})

// POST /auth/resend-verification   (requiere token) -> manda otro enlace al correo del usuario
authRoutes.post('/resend-verification', requireAuth, async (c) => {
  const user = await prisma.user.findUnique({ where: { id: c.get('userId') } })
  if (!user) return c.json({ message: 'No autorizado.' }, 401)
  if (user.emailVerifiedAt) return c.json({ message: 'Tu correo ya está verificado.' }, 400)

  const waitMs = resendWaitMs(user)
  if (waitMs > 0) {
    const seconds = Math.ceil(waitMs / 1000)
    return c.json({ message: `Espera ${seconds} s antes de pedir otro correo.` }, 429)
  }

  try {
    await sendVerificationEmail(user)
  } catch (err) {
    console.error('No se pudo enviar el correo de verificación:', err)
    return c.json({ message: 'No se pudo enviar el correo. Intenta de nuevo más tarde.' }, 502)
  }
  return c.json({ message: `Te enviamos un enlace nuevo a ${user.email}.` })
})