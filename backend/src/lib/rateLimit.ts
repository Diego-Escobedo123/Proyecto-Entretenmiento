/**
 * Límite de intentos con ventana fija, guardado en la tabla RateLimit (así
 * vale igual con varias instancias del backend).
 *
 * - `hit(key, limit)`: suma un intento y dice si ya se pasó del límite.
 * - `blockedFor(key, limit)`: solo mira, sin sumar (p. ej. antes de revisar
 *   una contraseña, cuando solo se cuentan los intentos fallidos).
 * - `limitByIp(acción, limit)`: middleware que cuenta cada petición por IP.
 *
 * Detrás del balanceador de AWS la IP real viene en X-Forwarded-For; solo se
 * lee si TRUST_PROXY=true, porque sin proxy ese header lo escribe el cliente.
 */
import type { Context, MiddlewareHandler } from 'hono'
import { getConnInfo } from 'hono/bun'
import { prisma } from './prisma'

const TRUST_PROXY = process.env.TRUST_PROXY === 'true'

export interface Limit {
  /** Intentos permitidos dentro de la ventana. */
  limit: number
  windowMs: number
}

export function clientIp(c: Context): string {
  if (TRUST_PROXY) {
    // El balanceador agrega la IP que ve al final; lo de antes lo pudo escribir el cliente.
    const last = c.req.header('X-Forwarded-For')?.split(',').at(-1)?.trim()
    if (last) return last
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

function secondsUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000))
}

/** Suma un intento. Devuelve los segundos que hay que esperar (0 = permitido). */
export async function hit(key: string, { limit, windowMs }: Limit): Promise<number> {
  const now = new Date()
  const bumped = await prisma.rateLimit.updateMany({
    where: { key, resetAt: { gt: now } },
    data: { count: { increment: 1 } },
  })

  if (bumped.count === 0) {
    // Primera vez o ventana vencida: empieza una nueva.
    const resetAt = new Date(now.getTime() + windowMs)
    await prisma.rateLimit.upsert({ where: { key }, create: { key, count: 1, resetAt }, update: { count: 1, resetAt } })
    // De vez en cuando, limpia las ventanas viejas para que la tabla no crezca.
    if (Math.random() < 0.01) void prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }).catch(() => {})
    return 0
  }

  const row = await prisma.rateLimit.findUnique({ where: { key } })
  return row && row.count > limit ? secondsUntil(row.resetAt) : 0
}

/** Segundos que faltan si ya se gastaron los `limit` intentos (0 = permitido). No suma nada. */
export async function blockedFor(key: string, { limit }: Limit): Promise<number> {
  const row = await prisma.rateLimit.findUnique({ where: { key } })
  if (!row || row.resetAt <= new Date() || row.count < limit) return 0
  return secondsUntil(row.resetAt)
}

/** Borra el contador (p. ej. tras un login correcto). */
export async function resetLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } })
}

export function tooManyAttempts(c: Context, seconds: number): Response {
  c.header('Retry-After', String(seconds))
  const minutes = Math.ceil(seconds / 60)
  return c.json({ message: `Demasiados intentos. Intenta de nuevo en ${minutes} min.` }, 429)
}

/** Middleware: cuenta cada petición por IP y responde 429 al pasarse. */
export function limitByIp(action: string, limit: Limit): MiddlewareHandler {
  return async (c, next) => {
    const wait = await hit(`${action}:${clientIp(c)}`, limit)
    if (wait > 0) return tooManyAttempts(c, wait)
    await next()
  }
}
