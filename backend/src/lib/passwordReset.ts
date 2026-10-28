/**
 * Contraseñas: recuperación con un enlace de un solo uso y cambio de contraseña.
 *
 * 1. POST /auth/forgot-password { email }: si existe la cuenta, se le manda un
 *    enlace APP_URL/reset-password?token=... que caduca en 1 hora. La respuesta
 *    es la misma exista o no, para no revelar qué correos están registrados.
 * 2. POST /auth/reset-password { token, password }: si el token sirve, cambia
 *    la contraseña y lo borra. Como abrir el enlace prueba que el correo es
 *    suyo, la cuenta también queda verificada.
 *
 * Cualquier cambio de contraseña (por enlace o desde Ajustes) pasa por
 * setPassword: sube `sessionVersion` (cierra todas las sesiones abiertas) y
 * avisa por correo.
 */
import type { User } from '@prisma/client'
import { prisma } from './prisma'
import { hashPassword } from './auth'
import { APP_URL, escapeHtml, sendEmail } from './email'
import { cooldownLeftMs, hashToken, newToken } from './tokens'
import { notifyPasswordChanged } from './accountNotices'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 h
/** Tiempo mínimo entre dos correos de recuperación a la misma cuenta. */
const COOLDOWN_MS = 60 * 1000

/**
 * Manda el enlace de recuperación si hay una cuenta con ese correo y no se
 * mandó otro hace menos de un minuto. No avisa si no la hay (ver arriba).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || cooldownLeftMs(user.passwordResetSentAt, COOLDOWN_MS) > 0) return

  const token = newToken()
  const now = new Date()
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: hashToken(token),
      passwordResetTokenExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
      passwordResetSentAt: now,
    },
  })

  const link = `${APP_URL}/reset-password?token=${token}`
  const name = escapeHtml(user.name)
  await sendEmail({
    to: user.email,
    subject: 'Restablece tu contraseña de Mosaic',
    text: `Hola, ${user.name}:\n\nPara elegir una contraseña nueva abre este enlace (caduca en 1 hora):\n${link}\n\nSi no lo pediste, ignora este mensaje: tu contraseña no cambia.`,
    html: `
      <p>Hola, ${name}:</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Mosaic.</p>
      <p><a href="${link}">Elegir una contraseña nueva</a></p>
      <p>El enlace caduca en 1 hora. Si no lo pediste, ignora este mensaje: tu contraseña no cambia.</p>
    `,
  })
}

/** Cambia la contraseña si el token es válido. Devuelve null si no sirve o caducó. */
export async function resetPassword(token: string, password: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { passwordResetTokenHash: hashToken(token) } })
  if (!user?.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) return null

  return setPassword(user, password, { verifyEmail: true })
}

/**
 * Guarda la contraseña nueva, cierra todas las sesiones (sube
 * `sessionVersion`), invalida cualquier enlace de recuperación pendiente y
 * avisa por correo. Devuelve el usuario actualizado (para firmar un token nuevo).
 */
export async function setPassword(
  user: Pick<User, 'id' | 'emailVerifiedAt'>,
  password: string,
  { verifyEmail = false } = {},
): Promise<User> {
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      sessionVersion: { increment: 1 },
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      ...(verifyEmail && !user.emailVerifiedAt && { emailVerifiedAt: new Date() }),
    },
  })
  notifyPasswordChanged(updated)
  return updated
}
