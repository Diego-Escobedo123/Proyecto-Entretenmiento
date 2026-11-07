/**
 * Tokens de un solo uso para los enlaces que se mandan por correo
 * (verificación de correo, recuperación de contraseña).
 *
 * El token en claro solo viaja en el enlace; en la base se guarda su SHA-256,
 * así que quien lea la base no puede armar un enlace válido.
 */

/** Token aleatorio de 256 bits, apto para URL. */
export function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
}

export function hashToken(token: string): string {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex')
}

/** Milisegundos que faltan para poder mandar otro correo (0 = ya se puede). */
export function cooldownLeftMs(lastSentAt: Date | null, cooldownMs: number): number {
  if (!lastSentAt) return 0
  return Math.max(0, lastSentAt.getTime() + cooldownMs - Date.now())
}
