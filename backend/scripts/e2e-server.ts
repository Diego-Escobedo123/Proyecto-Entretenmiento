/**
 * Backend para las pruebas e2e del frontend (EXP-075 / EXP-076).
 *
 * Levanta la API en el puerto 3100 usando SOLO la base de pruebas
 * (TEST_DATABASE_URL), la deja vacía al arrancar y no manda correos.
 * Playwright lo arranca solo (ver frontend/playwright.config.ts).
 */
import { testDatabaseUrl } from './test-db'

const port = Number(process.env.E2E_API_PORT ?? 3100)

process.env.DATABASE_URL = testDatabaseUrl()
process.env.PORT = String(port)
process.env.CORS_ORIGIN = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:5174'
process.env.RESEND_API_KEY = ''
// Las pruebas mandan X-Forwarded-For con una IP distinta por usuario: así el
// límite de registros por IP (10 por hora) no frena a las pruebas.
process.env.TRUST_PROXY = 'true'
process.env.JWT_SECRET ||= 'clave-solo-para-e2e'

const { prisma } = await import('../src/lib/prisma')
const { default: api } = await import('../src/index')

// Base vacía en cada corrida: las pruebas crean sus propios usuarios.
const tables = await prisma.$queryRaw<{ tablename: string }[]>`
  SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
if (tables.length) {
  const list = tables.map((t: { tablename: string }) => `"${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`)
}

Bun.serve({ port, fetch: api.fetch })
console.log(`API de pruebas e2e lista en http://localhost:${port}`)
