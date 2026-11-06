import { beforeEach, describe, expect, test } from 'bun:test'
import { db, resetDb } from '../helpers/prisma'
import { authHeader, body } from '../helpers/auth'

const { reviewRoutes } = await import('../../src/routes/reviews')

const author = (id: string) => ({ id, name: `Usuario ${id}`, profile: { handle: id, avatar: null } })

beforeEach(resetDb)

describe('GET /reviews (reseñas de una obra)', () => {
  test('401 sin token', async () => {
    expect((await reviewRoutes.request('/?type=movie&title=Dune')).status).toBe(401)
  })

  test('400 con un tipo de obra inválido', async () => {
    const res = await reviewRoutes.request('/?type=podcast&title=Dune', { headers: await authHeader() })
    expect(res.status).toBe(400)
  })

  test('400 si no dice qué obra (ni externalId ni title)', async () => {
    const res = await reviewRoutes.request('/?type=movie', { headers: await authHeader() })
    expect(res.status).toBe(400)
  })

  test('promedia las calificaciones y solo lista las que tienen texto', async () => {
    const headers = await authHeader('me')
    const updatedAt = new Date('2026-11-01T00:00:00Z')
    db.mediaEntry.findMany.mockResolvedValueOnce([
      { id: 'a', rating: 5, review: 'Obra maestra', updatedAt, user: author('u1') },
      { id: 'b', rating: 4, review: '   ', updatedAt, user: author('u2') }, // solo estrellas
      { id: 'c', rating: null, review: 'Sin estrellas', updatedAt, user: author('u3') },
    ])

    const res = await reviewRoutes.request('/?type=movie&externalId=tmdb:438631&title=Dune', { headers })
    expect(res.status).toBe(200)
    const data = await body(res)
    expect(data.average).toBe(4.5)
    expect(data.ratingCount).toBe(2)
    expect(data.reviews.map((r: { id: string }) => r.id)).toEqual(['a', 'c'])
    expect(data.reviews[0].user).toEqual({ id: 'u1', name: 'Usuario u1', handle: 'u1', avatar: null })

    // No incluye las reseñas del propio usuario.
    expect(db.mediaEntry.findMany.mock.calls[0]![0].where.userId).toEqual({ not: 'me' })
  })

  test('sin reseñas el promedio es null', async () => {
    const res = await reviewRoutes.request('/?type=book&title=Libro raro', { headers: await authHeader() })
    expect(await body(res)).toEqual({ average: null, ratingCount: 0, reviews: [] })
  })
})

describe('GET /reviews/stats', () => {
  test('cuenta personas por estado, estrellas y veces terminada', async () => {
    const headers = await authHeader('me')
    db.mediaEntry.findMany.mockResolvedValueOnce([
      { userId: 'u1', status: 'completed', rating: 5 },
      { userId: 'u2', status: 'mastered', rating: 4 },
      { userId: 'u3', status: 'in-progress', rating: null },
      { userId: 'u4', status: 'want', rating: null },
      { userId: 'u5', status: 'abandoned', rating: 1 },
    ])
    db.mediaEntry.findMany.mockResolvedValueOnce([{ status: 'completed', rating: 5, user: author('u1') }])
    db.logEntry.findMany.mockResolvedValueOnce([{ repeat: false }, { repeat: true }])

    const res = await reviewRoutes.request('/stats?type=movie&externalId=tmdb:1', { headers })
    expect(res.status).toBe(200)
    const data = await body(res)
    expect(data.people).toBe(5)
    expect(data.byStatus).toEqual({ want: 1, inProgress: 1, finished: 2, abandoned: 1 })
    expect(data.rating.average).toBe(3.3)
    expect(data.finishes).toBe(2)
    expect(data.repeats).toBe(1)
    expect(data.following).toHaveLength(1)
  })

  test('400 con un tipo de obra inválido', async () => {
    const res = await reviewRoutes.request('/stats?type=x&title=Dune', { headers: await authHeader() })
    expect(res.status).toBe(400)
  })
})
