/**
 * Envío de correos con Resend, llamando a su API REST con fetch (sin SDK).
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 *
 * Sin RESEND_API_KEY no se envía nada: el texto del correo se imprime en la
 * consola del servidor, así en local se puede seguir el enlace igual.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'Mosaic <onboarding@resend.dev>'

/** URL pública del frontend, sin barra final (los enlaces de los correos apuntan aquí). */
export const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')

export interface Email {
  to: string
  subject: string
  html: string
  /** Versión en texto plano, para clientes que no muestran HTML. */
  text: string
}

export async function sendEmail(email: Email): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(`[email] RESEND_API_KEY vacía, no se envía. Para: ${email.to} | ${email.subject}\n${email.text}`)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, ...email }),
  })
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`)
}

/** Escapa texto del usuario (p. ej. su nombre) antes de meterlo en el HTML del correo. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
