/**
 * Avisos de seguridad por correo: se mandan cuando cambia algo importante de
 * la cuenta, para que el dueño se entere si no fue él. Si fallan solo se
 * registra el error; el cambio ya se hizo igual.
 */
import { APP_URL, escapeHtml, sendEmail } from './email'

function send(to: string, subject: string, text: string, html: string): void {
  void sendEmail({ to, subject, text, html }).catch((err) => console.error(`No se pudo enviar "${subject}":`, err))
}

export function notifyPasswordChanged(user: { name: string; email: string }): void {
  const link = `${APP_URL}/forgot-password`
  send(
    user.email,
    'Tu contraseña de Mosaic cambió',
    `Hola, ${user.name}:\n\nLa contraseña de tu cuenta de Mosaic acaba de cambiar y se cerraron las demás sesiones.\n\nSi no fuiste tú, recupera tu cuenta aquí:\n${link}`,
    `
      <p>Hola, ${escapeHtml(user.name)}:</p>
      <p>La contraseña de tu cuenta de Mosaic acaba de cambiar y se cerraron las demás sesiones.</p>
      <p>Si no fuiste tú, <a href="${link}">recupera tu cuenta aquí</a>.</p>
    `,
  )
}

/** Se manda al correo anterior, que es el que el dueño seguro sigue leyendo. */
export function notifyEmailChanged(user: { name: string }, oldEmail: string, newEmail: string): void {
  send(
    oldEmail,
    'El correo de tu cuenta de Mosaic cambió',
    `Hola, ${user.name}:\n\nEl correo de tu cuenta de Mosaic ahora es ${newEmail}. Este correo (${oldEmail}) ya no sirve para entrar.\n\nSi no fuiste tú, contacta a un administrador de Mosaic.`,
    `
      <p>Hola, ${escapeHtml(user.name)}:</p>
      <p>El correo de tu cuenta de Mosaic ahora es <strong>${escapeHtml(newEmail)}</strong>.
      Este correo (${escapeHtml(oldEmail)}) ya no sirve para entrar.</p>
      <p>Si no fuiste tú, contacta a un administrador de Mosaic.</p>
    `,
  )
}
