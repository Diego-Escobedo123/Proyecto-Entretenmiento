import { sign, verify, verifyWithJwks } from 'hono/jwt'

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const ALG = 'HS256' as const
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 días

/** Hash de contraseña con la API nativa de Bun (bcrypt por debajo). */
export function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return Bun.password.verify(plain, hash)
}

export interface TokenPayload {
  sub: string // id del usuario
  exp: number
}

export function signToken(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  return sign({ sub: userId, exp }, SECRET, ALG)
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const payload = await verify(token, SECRET, ALG)
    const sub = payload.sub
    const exp = payload.exp
    if (typeof sub !== 'string' || typeof exp !== 'number') return null
    return { sub, exp }
  } catch {
    return null
  }
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ''
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'

export interface GoogleIdentity {
  email: string
  name: string
}

export function isGoogleAuthEnabled(): boolean {
  return GOOGLE_CLIENT_ID !== ''
}

/**
 * Verifica un ID token de Google Identity Services: firma (llaves públicas de
 * Google), emisor, audiencia (= nuestro client id) y expiración.
 * Devuelve null si el token no es válido o el correo no está verificado.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  if (!GOOGLE_CLIENT_ID) return null
  try {
    const payload = await verifyWithJwks(idToken, {
      jwks_uri: GOOGLE_JWKS_URI,
      allowedAlgorithms: ['RS256'],
      verification: { iss: /^(https:\/\/)?accounts\.google\.com$/, aud: GOOGLE_CLIENT_ID },
    })
    const { email, email_verified, name } = payload
    if (typeof email !== 'string' || email_verified !== true) return null
    return { email, name: typeof name === 'string' && name.trim() ? name.trim() : email.split('@')[0] }
  } catch {
    return null
  }
}
