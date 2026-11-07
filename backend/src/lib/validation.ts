import type { Context } from 'hono'
import { z, type ZodType } from 'zod'

/**
 * Lee el body JSON de la petición y lo valida con un esquema de Zod.
 *
 * - Si es válido devuelve `{ ok: true, data }` con los datos ya limpios
 *   (recortados, convertidos y sin campos desconocidos).
 * - Si no, devuelve `{ ok: false, response }`: un 400 con el mismo formato de
 *   error que ya usa el frontend (`{ message, field }`), con el mensaje del
 *   primer problema encontrado.
 *
 * Uso en una ruta:
 *   const parsed = await validateBody(c, createGoalSchema)
 *   if (!parsed.ok) return parsed.response
 *   const { year, type, target } = parsed.data
 */
export async function validateBody<T extends ZodType>(
  c: Context,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  const body = await c.req.json().catch(() => ({}))
  const result = schema.safeParse(body)
  if (result.success) return { ok: true, data: result.data }

  const issue = result.error.issues[0]
  const field = typeof issue?.path[0] === 'string' ? issue.path[0] : undefined
  return {
    ok: false,
    response: c.json({ message: issue?.message ?? 'Datos inválidos.', ...(field && { field }) }, 400),
  }
}