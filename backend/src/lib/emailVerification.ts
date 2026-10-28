/**
 * Verificación de correo con un enlace de un solo uso.
 *
 * 1. Al registrarse (o al pedir reenvío) se genera un token aleatorio. En la
 *    base solo se guarda su SHA-256 y su caducidad; el token en claro va en el
 *    enlace del correo: APP_URL/verify-email?token=...
 * 2. El frontend abre esa ruta y manda el token a POST /auth/verify-email.
 * 3. Si el hash coincide y no caducó, se marca `emailVerifiedAt` y el token se
 *    borra (no sirve dos veces).
 *
 * Mandar un enlace nuevo invalida el anterior. Sin verificar se puede usar la
 * app igual: el frontend solo muestra un aviso para verificar.
 */
import type { User } from '@prisma/client'
import { prisma } from './prisma'
import { APP_URL, escapeHtml, sendEmail } from './email'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 h
/** Tiempo mínimo entre dos correos de verificación al mismo usuario. */
export const RESEND_COOLDOWN_MS = 60 * 1000

function hashToken(token: string): string {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex')
}

function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
}

/** Milisegundos que faltan para poder reenviar el correo (0 = ya se puede). */
export function resendWaitMs(user: Pick<User, 'emailVerifySentAt'>): number {
  if (!user.emailVerifySentAt) return 0
  return Math.max(0, user.emailVerifySentAt.getTime() + RESEND_COOLDOWN_MS - Date.now())
}

/** Genera un enlace nuevo (invalida el anterior) y lo manda por correo. */
export async function sendVerificationEmail(user: Pick<User, 'id' | 'name' | 'email'>): Promise<void> {
  const token = newToken()
  const now = new Date()
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifyTokenHash: hashToken(token),
      emailVerifyTokenExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
      emailVerifySentAt: now,
    },
  })

  const link = `${APP_URL}/verify-email?token=${token}`
  const name = escapeHtml(user.name)
  await sendEmail({
    to: user.email,
    subject: 'Confirma tu correo en Mosaic',
    text: `Hola, ${user.name}:\n\nConfirma tu correo abriendo este enlace (caduca en 24 horas):\n${link}\n\nSi no creaste una cuenta en Mosaic, ignora este mensaje.`,
    html: `
      <p>Hola, ${name}:</p>
      <p>Confirma tu correo para terminar de configurar tu cuenta en Mosaic.</p>
      <p><a href="${link}">Confirmar mi correo</a></p>
      <p>El enlace caduca en 24 horas. Si no creaste una cuenta en Mosaic, ignora este mensaje.</p>
    `,
  })
}

/** Marca el correo como verificado si el token es válido. Devuelve null si no sirve o caducó. */
export async function verifyEmailToken(token: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { emailVerifyTokenHash: hashToken(token) } })
  if (!user?.emailVerifyTokenExpiresAt || user.emailVerifyTokenExpiresAt < new Date()) return null

  return prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), emailVerifyTokenHash: null, emailVerifyTokenExpiresAt: null },
  })
}
