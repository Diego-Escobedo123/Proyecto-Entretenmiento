/**
 * Base de datos falsa para las pruebas unitarias.
 *
 * Reemplaza `src/lib/prisma` por un objeto donde cada `db.<modelo>.<método>`
 * es una función simulada (mock). Así las pruebas no necesitan PostgreSQL:
 * cada prueba dice qué "devuelve la base" y revisa qué se le pidió.
 *
 *   db.user.findUnique.mockResolvedValueOnce({ id: 'u1', ... })
 *   expect(db.user.create).toHaveBeenCalled()
 *
 * Importar este archivo ANTES que las rutas (las rutas se importan con
 * `await import(...)` para que ya usen la base falsa).
 */
import { mock, type Mock } from 'bun:test'

type Method = Mock<(...args: any[]) => Promise<any>>
type Model = Record<string, Method>

/** Lo que "devuelve la base" si la prueba no dice otra cosa. */
function defaultResult(method: string, args: any): any {
  switch (method) {
    case 'findMany':
      return []
    case 'count':
      return 0
    case 'updateMany':
    case 'deleteMany':
      return { count: 0 }
    case 'create':
    case 'update':
    case 'upsert':
      return { id: 'mock-id', ...(args?.data ?? args?.create) }
    default:
      return null // findUnique, findFirst, delete...
  }
}

const models = new Map<string, Model>()

function model(name: string): Model {
  let m = models.get(name)
  if (!m) {
    const methods: Model = {}
    m = new Proxy(methods, {
      get(target, method: string) {
        target[method] ??= mock(async (args?: any) => defaultResult(method, args))
        return target[method]
      },
    })
    models.set(name, m)
  }
  return m
}

/** `db.user`, `db.mediaEntry`, `db.rateLimit`... */
export const db = new Proxy({} as Record<string, Model>, { get: (_, name: string) => model(name) })

/** Borra lo configurado en la prueba anterior (va en beforeEach). */
export function resetDb(): void {
  models.clear()
}

mock.module('../../src/lib/prisma', () => ({ prisma: db }))
