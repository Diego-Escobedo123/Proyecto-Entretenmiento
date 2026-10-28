/**
 * Reglas de correo y contraseña que se revisan antes de mandar los formularios
 * de cuenta (registro, restablecer y cambiar contraseña, cambiar correo).
 * Son las mismas que valida el backend (backend/src/lib/schemas.ts); aquí solo
 * sirven para avisar antes de enviar.
 */

export const MIN_PASSWORD = 8
export const PASSWORD_HINT = `Mínimo ${MIN_PASSWORD} caracteres`

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Mensaje de error del correo, o undefined si está bien. */
export function emailError(email: string): string | undefined {
  const value = email.trim()
  if (!value) return 'Ingresa tu correo.'
  if (!EMAIL_PATTERN.test(value)) return 'Ingresa un correo válido.'
  return undefined
}

/** Mensaje de error de una contraseña nueva, o undefined si está bien. */
export function newPasswordError(password: string): string | undefined {
  return password.length >= MIN_PASSWORD ? undefined : `${PASSWORD_HINT}.`
}
