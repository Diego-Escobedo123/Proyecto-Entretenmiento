/**
 * Herramientas de las pruebas de integración: la API completa (src/index.ts)
 * contra una base PostgreSQL de pruebas REAL. A diferencia de las unitarias,
 * aquí nada es simulado: se guardan y se leen filas de verdad.
 */
import { testDatabaseUrl } from '../../scripts/test-db'
import { prisma } from '../../src/lib/prisma'
import server from '../../src/index'

testDatabaseUrl() // falla con un mensaje claro si no hay base de pruebas

export { prisma }

/** Deja la base vacía (menos el historial de migraciones). Va en beforeEach. */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (tables.length) {
    const list = tables.map((t: { tablename: string }) => `"${t.tablename}"`).join(', ')
    await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`)
  }
}

interface Options {
  method?: string
  token?: string
  body?: unknown
}

/** Llama a la API como lo haría el frontend. Devuelve el status y el JSON. */
export async function api(path: string, { method = 'GET', token, body }: Options = {}) {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await server.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
  const text = await res.text()
  return { status: res.status, body: (text ? JSON.parse(text) : null) as any }
}

/** Registra un usuario por la API y devuelve su token y sus datos. */
export async function registerUser(name: string, email: string, password = 'secreta123') {
  const res = await api('/auth/register', { method: 'POST', body: { name, email, password } })
  if (res.status !== 201) throw new Error(`No se pudo registrar ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  return { token: res.body.token as string, user: res.body.user as { id: string; email: string }, password }
}
