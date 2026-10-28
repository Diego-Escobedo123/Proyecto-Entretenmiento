import { Hono, type Context } from 'hono'
import type { User } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { hashPassword, isGoogleAuthEnabled, signToken, verifyGoogleIdToken, verifyPassword } from '../lib/auth'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { validateBody } from '../lib/validation'
import {
  changeEmailSchema,
  changePasswordSchema,
  confirmEmailChangeSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  googleLoginSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../lib/schemas'
import { resendWaitMs, sendVerificationEmail, verifyEmailToken } from '../lib/emailVerification'
import { requestPasswordReset, resetPassword, setPassword } from '../lib/passwordReset'
import { confirmEmailChange, emailChangeWaitMs, requestEmailChange } from '../lib/emailChange'
import { blockedFor, hit, limitByIp, resetLimit, tooManyAttempts, type Limit } from '../lib/rateLimit'

export const authRoutes = new Hono<AuthEnv>()

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// Límites de intentos (ver lib/rateLimit). Por IP frenan a quien prueba muchas
// cuentas o manda muchos correos; por cuenta, a quien prueba muchas contraseñas.
const LIMITS = {
  loginPerIp: { limit: 20, windowMs: 15 * MINUTE },
  /** Solo cuentan los intentos fallidos; un login correcto lo reinicia. */
  loginFailuresPerEmail: { limit: 10, windowMs: 15 * MINUTE },
  registerPerIp: { limit: 10, windowMs: HOUR },
  forgotPasswordPerIp: { limit: 5, windowMs: HOUR },
  /** Abrir enlaces de correo (verificar, restablecer, confirmar cambio). */
  emailLinkPerIp: { limit: 30, windowMs: 15 * MINUTE },
  /** Contraseña actual mal escrita al cambiar contraseña o correo. */
  passwordCheckFailuresPerUser: { limit: 5, windowMs: 15 * MINUTE },
} satisfies Record<string, Limit>

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    /** Correo nuevo que espera confirmación (ver lib/emailChange). */
    pendingEmail: user.pendingEmail,
  }
}

/**
 * Revisa la contraseña actual del usuario con sesión (para cambiar contraseña
 * o correo). Los fallos cuentan para el límite por usuario. Devuelve una
 * respuesta de error (con `field` para marcar el campo del formulario), o
 * null si la contraseña es correcta.
 */
async function checkCurrentPassword(c: Context, user: User, password: string, field: string): Promise<Response | null> {
  const key = `password-check:${user.id}`
  const wait = await blockedFor(key, LIMITS.passwordCheckFailuresPerUser)
  if (wait > 0) return tooManyAttempts(c, wait)

  if (await verifyPassword(password, user.passwordHash)) {
    await resetLimit(key)
    return null
  }
  await hit(key, LIMITS.passwordCheckFailuresPerUser)
  return c.json({ message: 'La contraseña actual no es correcta.', field }, 400)
}

// POST /auth/register  { name, email, password }
authRoutes.post('/register', limitByIp('register', LIMITS.registerPerIp), async (c) => {
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

  return c.json({ token: await signToken(user), user: publicUser(user) }, 201)
})

// POST /auth/login  { email, password }
authRoutes.post('/login', limitByIp('login', LIMITS.loginPerIp), async (c) => {
  const parsed = await validateBody(c, loginSchema)
  if (!parsed.ok) return parsed.response
  const { email, password } = parsed.data

  const emailKey = `login-email:${email}`
  const wait = await blockedFor(emailKey, LIMITS.loginFailuresPerEmail)
  if (wait > 0) return tooManyAttempts(c, wait)

  const user = await prisma.user.findUnique({ where: { email } })
  const ok = user ? await verifyPassword(password, user.passwordHash) : false
  if (!user || !ok) {
    await hit(emailKey, LIMITS.loginFailuresPerEmail)
    return c.json({ message: 'Correo o contraseña incorrectos.' }, 401)
  }

  await resetLimit(emailKey)
  return c.json({ token: await signToken(user), user: publicUser(user) })
})

// POST /auth/google  { idToken }  (ID token del botón de Google Identity Services)
authRoutes.post('/google', limitByIp('login', LIMITS.loginPerIp), async (c) => {
  if (!isGoogleAuthEnabled()) {
    return c.json({ message: 'El inicio con Google no está configurado en el servidor.' }, 503)
  }

  const parsed = await validateBody(c, googleLoginSchema)
  if (!parsed.ok) return parsed.response
  const { idToken } = parsed.data

  const google = await verifyGoogleIdToken(idToken)
  if (!google) return c.json({ message: 'No se pudo verificar la cuenta de Google.' }, 401)

  // Si ya existe una cuenta con ese correo, entra a esa misma cuenta.
  // Si no, se crea con una contraseña aleatoria: solo podrá entrar con Google
  // (o elegir una contraseña con "¿Olvidaste tu contraseña?").
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
  return c.json({ token: await signToken(user), user: publicUser(user), isNew: !existing })
})

// GET /auth/me   (requiere token) -> usuario actual
authRoutes.get('/me', requireAuth, async (c) => {
  const user = await prisma.user.findUnique({ where: { id: c.get('userId') } })
  if (!user) return c.json({ message: 'No autorizado.' }, 401)
  return c.json({ user: publicUser(user) })
})

// POST /auth/verify-email  { token }  (token del enlace del correo; no pide sesión)
authRoutes.post('/verify-email', limitByIp('email-link', LIMITS.emailLinkPerIp), async (c) => {
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

// POST /auth/forgot-password  { email }  -> siempre la misma respuesta, exista o no la cuenta
authRoutes.post('/forgot-password', limitByIp('forgot-password', LIMITS.forgotPasswordPerIp), async (c) => {
  const parsed = await validateBody(c, forgotPasswordSchema)
  if (!parsed.ok) return parsed.response

  // Sin await: si respondiera más tarde cuando la cuenta existe, el tiempo de
  // respuesta delataría qué correos están registrados.
  void requestPasswordReset(parsed.data.email).catch((err) =>
    console.error('No se pudo enviar el correo de recuperación:', err),
  )
  return c.json({ message: 'Si hay una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña.' })
})

// POST /auth/reset-password  { token, password }  (token del enlace del correo; no pide sesión)
authRoutes.post('/reset-password', limitByIp('email-link', LIMITS.emailLinkPerIp), async (c) => {
  const parsed = await validateBody(c, resetPasswordSchema)
  if (!parsed.ok) return parsed.response

  const user = await resetPassword(parsed.data.token, parsed.data.password)
  if (!user) return c.json({ message: 'El enlace no es válido o ya caducó. Pide uno nuevo.' }, 400)
  return c.json({ message: 'Listo, ya puedes iniciar sesión con tu contraseña nueva.' })
})

// POST /auth/change-password  { currentPassword, newPassword }  (requiere token)
// -> cierra las demás sesiones y devuelve un token nuevo para seguir en esta.
authRoutes.post('/change-password', requireAuth, async (c) => {
  const parsed = await validateBody(c, changePasswordSchema)
  if (!parsed.ok) return parsed.response
  const { currentPassword, newPassword } = parsed.data

  const user = await prisma.user.findUnique({ where: { id: c.get('userId') } })
  if (!user) return c.json({ message: 'No autorizado.' }, 401)

  const error = await checkCurrentPassword(c, user, currentPassword, 'currentPassword')
  if (error) return error
  if (currentPassword === newPassword) {
    return c.json({ message: 'La contraseña nueva tiene que ser distinta de la actual.', field: 'newPassword' }, 400)
  }

  const updated = await setPassword(user, newPassword)
  return c.json({ token: await signToken(updated), user: publicUser(updated), message: 'Tu contraseña cambió.' })
})

// POST /auth/change-email  { email, password }  (requiere token) -> manda un enlace al correo nuevo
authRoutes.post('/change-email', requireAuth, async (c) => {
  const parsed = await validateBody(c, changeEmailSchema)
  if (!parsed.ok) return parsed.response
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { id: c.get('userId') } })
  if (!user) return c.json({ message: 'No autorizado.' }, 401)

  const error = await checkCurrentPassword(c, user, password, 'password')
  if (error) return error

  if (email === user.email) return c.json({ message: 'Ese ya es tu correo.', field: 'email' }, 400)
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (taken) return c.json({ message: 'Ese correo ya está registrado.', field: 'email' }, 409)

  const waitMs = emailChangeWaitMs(user)
  if (waitMs > 0) {
    return c.json({ message: `Espera ${Math.ceil(waitMs / 1000)} s antes de pedir otro cambio.` }, 429)
  }

  try {
    await requestEmailChange(user, email)
  } catch (err) {
    console.error('No se pudo enviar el correo de cambio de correo:', err)
    return c.json({ message: 'No se pudo enviar el correo. Intenta de nuevo más tarde.' }, 502)
  }
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
  return c.json({ user: publicUser(updated), message: `Te enviamos un enlace a ${email} para confirmar el cambio.` })
})

// POST /auth/confirm-email-change  { token }  (token del enlace del correo nuevo; no pide sesión)
authRoutes.post('/confirm-email-change', limitByIp('email-link', LIMITS.emailLinkPerIp), async (c) => {
  const parsed = await validateBody(c, confirmEmailChangeSchema)
  if (!parsed.ok) return parsed.response

  const result = await confirmEmailChange(parsed.data.token)
  if (!result.ok) {
    return result.reason === 'taken'
      ? c.json({ message: 'Ese correo ya lo usa otra cuenta. Elige otro desde Ajustes.' }, 409)
      : c.json({ message: 'El enlace no es válido o ya caducó. Pide el cambio de nuevo desde Ajustes.' }, 400)
  }
  return c.json({ user: publicUser(result.user) })
})

// DELETE /auth/account  { confirm: "ELIMINAR" }  (requiere token) -> borra la cuenta y todo lo suyo
authRoutes.delete('/account', requireAuth, async (c) => {
  const parsed = await validateBody(c, deleteAccountSchema)
  if (!parsed.ok) return parsed.response

  const user = await prisma.user.findUnique({ where: { id: c.get('userId') }, select: { id: true, role: true } })
  if (!user) return c.json({ message: 'No autorizado.' }, 401)

  // Igual que en /admin: siempre tiene que quedar al menos un admin.
  if (user.role === 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (admins <= 1) {
      return c.json({ message: 'Eres el único administrador. Nombra a otro admin antes de eliminar tu cuenta.' }, 400)
    }
  }

  // Obras, listas, diario, seguidores, notificaciones, etc. se borran en cascada (ver schema.prisma).
  await prisma.user.delete({ where: { id: user.id } })
  return c.body(null, 204)
})
