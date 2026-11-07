/**
 * Cambio de correo en dos pasos, para no dejar la cuenta atada a un correo
 * mal escrito o ajeno.
 *
 * 1. POST /auth/change-email { email, password } (con sesión): se guarda como
 *    `pendingEmail` y se manda un enlace a ESE correo nuevo
 *    (APP_URL/confirm-email-change?token=..., caduca en 24 h).
 * 2. POST /auth/confirm-email-change { token }: si el token sirve y el correo
 *    sigue libre, pasa a ser el de la cuenta (ya verificado) y se avisa al
 *    correo anterior.
 *
 * Hasta confirmar, la cuenta sigue entrando con el correo de siempre.
 */
import type { User } from '@prisma/client'
import { prisma } from './prisma'
import { APP_URL, escapeHtml, sendEmail } from './email'
import { cooldownLeftMs, hashToken, newToken } from './tokens'
import { notifyEmailChanged } from './accountNotices'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 h
/** Tiempo mínimo entre dos pedidos de cambio de correo del mismo usuario. */
export const EMAIL_CHANGE_COOLDOWN_MS = 60 * 1000

export function emailChangeWaitMs(user: Pick<User, 'emailChangeSentAt'>): number {
  return cooldownLeftMs(user.emailChangeSentAt, EMAIL_CHANGE_COOLDOWN_MS)
}

/** Guarda el correo nuevo como pendiente y le manda el enlace de confirmación. */
export async function requestEmailChange(user: Pick<User, 'id' | 'name'>, newEmail: string): Promise<void> {
  const token = newToken()
  const now = new Date()
  await prisma.user.update({
    where: { id: user.id },
    data: {
      pendingEmail: newEmail,
      emailChangeTokenHash: hashToken(token),
      emailChangeTokenExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
      emailChangeSentAt: now,
    },
  })

  const link = `${APP_URL}/confirm-email-change?token=${token}`
  await sendEmail({
    to: newEmail,
    subject: 'Confirma tu nuevo correo en Mosaic',
    text: `Hola, ${user.name}:\n\nPara usar este correo en tu cuenta de Mosaic abre este enlace (caduca en 24 horas):\n${link}\n\nSi no lo pediste, ignora este mensaje.`,
    html: `
      <p>Hola, ${escapeHtml(user.name)}:</p>
      <p>Para usar este correo en tu cuenta de Mosaic, confírmalo:</p>
      <p><a href="${link}">Confirmar mi nuevo correo</a></p>
      <p>El enlace caduca en 24 horas. Si no lo pediste, ignora este mensaje.</p>
    `,
  })
}

export type ConfirmEmailChangeResult = { ok: true; user: User } | { ok: false; reason: 'invalid' | 'taken' }

/** Aplica el cambio si el token es válido y el correo nuevo sigue libre. */
export async function confirmEmailChange(token: string): Promise<ConfirmEmailChangeResult> {
  const user = await prisma.user.findUnique({ where: { emailChangeTokenHash: hashToken(token) } })
  if (!user?.pendingEmail || !user.emailChangeTokenExpiresAt || user.emailChangeTokenExpiresAt < new Date()) {
    return { ok: false, reason: 'invalid' }
  }

  // Alguien pudo registrarse con ese correo mientras tanto.
  const taken = await prisma.user.findUnique({ where: { email: user.pendingEmail }, select: { id: true } })
  if (taken) return { ok: false, reason: 'taken' }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      email: user.pendingEmail,
      emailVerifiedAt: new Date(),
      pendingEmail: null,
      emailChangeTokenHash: null,
      emailChangeTokenExpiresAt: null,
      // Los enlaces que se mandaron al correo anterior ya no deben servir.
      emailVerifyTokenHash: null,
      emailVerifyTokenExpiresAt: null,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    },
  })
  notifyEmailChanged(updated, user.email, updated.email)
  return { ok: true, user: updated }
}
