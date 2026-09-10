import { sign, verify } from 'hono/jwt'

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
