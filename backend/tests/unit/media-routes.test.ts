import { beforeEach, describe, expect, test } from 'bun:test'
import { db, resetDb } from '../helpers/prisma'
import { authHeader, body } from '../helpers/auth'

const { mediaRoutes } = await import('../../src/routes/media')

/** Fila de MediaEntry como la devolvería la base. */
function row(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-11-01T12:00:00Z')
  return {
    id: 'entry-1',
    userId: 'user-1',
    type: 'book',
    title: 'Dune',
    creator: 'Frank Herbert',
    status: 'want',
    year: 1965,
    rating: null,
    progress: null,
    pagesRead: null,
    pagesTotal: null,
    season: null,
    episode: null,
    hoursPlayed: null,
    platform: null,
    favorite: false,
    genres: [],
    review: '',
    notes: '',
    notesPublic: false,
    cover: null,
    externalId: 'gbooks:123',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const send = (method: string, headers: Record<string, string>, body?: unknown) => ({
  method,
  headers,
  ...(body !== undefined && { body: JSON.stringify(body) }),
})

beforeEach(resetDb)

describe('/media requiere sesión', () => {
  test('401 sin token', async () => {
    expect((await mediaRoutes.request('/')).status).toBe(401)
  })
})

describe('POST /media (registrar obra)', () => {
  test('guarda la obra a nombre del usuario y la devuelve', async () => {
    const headers = await authHeader('user-1')
    db.mediaEntry.create.mockResolvedValueOnce(row({ status: 'completed', rating: 4.5 }))
    const res = await mediaRoutes.request(
      '/',
      send('POST', headers, { type: 'book', title: 'Dune', status: 'completed', rating: 4.5, userId: 'otro' }),
    )
    expect(res.status).toBe(201)
    expect(await body(res)).toMatchObject({ id: 'entry-1', title: 'Dune', status: 'completed', rating: 4.5 })

    const data = db.mediaEntry.create.mock.calls[0]![0].data
    expect(data.userId).toBe('user-1') // nunca el userId que mande el cliente
    expect(db.logEntry.create).toHaveBeenCalled() // terminarla queda en el diario
  })

  test('400 si falta el título', async () => {
    const res = await mediaRoutes.request('/', send('POST', await authHeader(), { type: 'book' }))
    expect(res.status).toBe(400)
    expect(db.mediaEntry.create).not.toHaveBeenCalled()
  })

  test('400 si la fecha de inicio es posterior a la de fin', async () => {
    const res = await mediaRoutes.request(
      '/',
      send('POST', await authHeader(), {
        type: 'book',
        title: 'Dune',
        status: 'completed',
        logDate: '2026-01-01',
        startDate: '2026-02-01',
      }),
    )
    expect(res.status).toBe(400)
    expect(await body(res)).toMatchObject({ field: 'startDate' })
  })

  test('marcarla como pendiente no crea entradas en el diario', async () => {
    db.mediaEntry.create.mockResolvedValueOnce(row({ status: 'want' }))
    const res = await mediaRoutes.request('/', send('POST', await authHeader(), { type: 'book', title: 'Dune' }))
    expect(res.status).toBe(201)
    expect(db.logEntry.create).not.toHaveBeenCalled()
  })
})

describe('GET /media', () => {
  test('lista solo las obras del usuario', async () => {
    const headers = await authHeader('user-1')
    db.mediaEntry.findMany.mockResolvedValueOnce([row()])
    const res = await mediaRoutes.request('/', { headers })
    expect(res.status).toBe(200)
    expect(await body(res)).toHaveLength(1)
    expect(db.mediaEntry.findMany.mock.calls[0]![0].where).toEqual({ userId: 'user-1' })
  })

  test('404 si la obra no existe o es de otra persona', async () => {
    const res = await mediaRoutes.request('/entry-x', { headers: await authHeader() })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /media/:id', () => {
  test('cambia el estado y lo registra en el diario', async () => {
    const headers = await authHeader()
    db.mediaEntry.findFirst.mockResolvedValueOnce(row({ status: 'want' }))
    db.mediaEntry.update.mockResolvedValueOnce(row({ status: 'in-progress' }))
    const res = await mediaRoutes.request('/entry-1', send('PATCH', headers, { status: 'in-progress' }))
    expect(res.status).toBe(200)
    expect((await body(res)).status).toBe('in-progress')
    expect(db.logEntry.create).toHaveBeenCalled()
  })

  test('404 al editar una obra ajena', async () => {
    const res = await mediaRoutes.request('/entry-x', send('PATCH', await authHeader(), { status: 'completed' }))
    expect(res.status).toBe(404)
    expect(db.mediaEntry.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /media/:id', () => {
  test('borra la obra propia', async () => {
    const headers = await authHeader()
    db.mediaEntry.findFirst.mockResolvedValueOnce(row())
    const res = await mediaRoutes.request('/entry-1', { method: 'DELETE', headers })
    expect(res.status).toBe(204)
    expect(db.mediaEntry.delete).toHaveBeenCalledWith({ where: { id: 'entry-1' } })
  })
})
