import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { api, prisma, registerUser, resetDatabase } from './helpers'

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

const dune = {
  type: 'movie',
  title: 'Dune',
  externalId: 'tmdb:438631',
  status: 'completed',
  rating: 4.5,
  review: 'Una obra maestra visual.',
}

describe('GET /health', () => {
  test('responde ok', async () => {
    const res = await api('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('POST /auth/register', () => {
  test('crea el usuario y su perfil en la base, con la contraseña cifrada', async () => {
    const res = await api('/auth/register', {
      method: 'POST',
      body: { name: 'Ana', email: 'Ana@Correo.com', password: 'secreta123' },
    })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeString()

    const user = await prisma.user.findUnique({ where: { email: 'ana@correo.com' }, include: { profile: true } })
    expect(user).not.toBeNull()
    expect(user!.passwordHash).not.toBe('secreta123')
    expect(user!.profile?.handle).toBe('ana')
  })

  test('409 si el correo ya existe (sin importar mayúsculas)', async () => {
    await registerUser('Ana', 'ana@correo.com')
    const res = await api('/auth/register', {
      method: 'POST',
      body: { name: 'Otra Ana', email: 'ANA@correo.com', password: 'secreta123' },
    })
    expect(res.status).toBe(409)
    expect(await prisma.user.count()).toBe(1)
  })
})

describe('POST /auth/login', () => {
  test('entra con la contraseña correcta y rechaza la incorrecta', async () => {
    await registerUser('Ana', 'ana@correo.com', 'secreta123')

    const ok = await api('/auth/login', { method: 'POST', body: { email: 'ana@correo.com', password: 'secreta123' } })
    expect(ok.status).toBe(200)
    expect(ok.body.user.email).toBe('ana@correo.com')

    const bad = await api('/auth/login', { method: 'POST', body: { email: 'ana@correo.com', password: 'otra-cosa' } })
    expect(bad.status).toBe(401)
  })
})

describe('GET /auth/me y sesiones', () => {
  test('el token del registro sirve para ver la cuenta', async () => {
    const { token } = await registerUser('Ana', 'ana@correo.com')
    const res = await api('/auth/me', { token })
    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Ana')
  })

  test('al cambiar la contraseña, el token viejo deja de servir', async () => {
    const { token } = await registerUser('Ana', 'ana@correo.com', 'secreta123')
    const changed = await api('/auth/change-password', {
      method: 'POST',
      token,
      body: { currentPassword: 'secreta123', newPassword: 'nueva-clave-456' },
    })
    expect(changed.status).toBe(200)

    expect((await api('/auth/me', { token })).status).toBe(401)
    expect((await api('/auth/me', { token: changed.body.token })).status).toBe(200)
  })
})

describe('/media (registro de obras)', () => {
  test('registrar una obra terminada la guarda y la anota en el diario', async () => {
    const { token, user } = await registerUser('Ana', 'ana@correo.com')

    const created = await api('/media', { method: 'POST', token, body: dune })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ title: 'Dune', status: 'completed', rating: 4.5 })

    const logs = await prisma.logEntry.findMany({ where: { userId: user.id } })
    expect(logs).toHaveLength(1)
    expect(logs[0]!.finishedAt).not.toBeNull()

    const list = await api('/media', { token })
    expect(list.body.map((e: { title: string }) => e.title)).toEqual(['Dune'])
  })

  test('cada usuario solo ve y edita sus propias obras', async () => {
    const ana = await registerUser('Ana', 'ana@correo.com')
    const beto = await registerUser('Beto', 'beto@correo.com')
    const { body: entry } = await api('/media', { method: 'POST', token: ana.token, body: dune })

    expect((await api('/media', { token: beto.token })).body).toEqual([])
    expect((await api(`/media/${entry.id}`, { token: beto.token })).status).toBe(404)
    const patch = await api(`/media/${entry.id}`, { method: 'PATCH', token: beto.token, body: { rating: 1 } })
    expect(patch.status).toBe(404)

    const stored = await prisma.mediaEntry.findUnique({ where: { id: entry.id } })
    expect(stored!.rating).toBe(4.5) // no cambió
  })

  test('borrar una obra la quita de la base', async () => {
    const { token } = await registerUser('Ana', 'ana@correo.com')
    const { body: entry } = await api('/media', { method: 'POST', token, body: dune })

    expect((await api(`/media/${entry.id}`, { method: 'DELETE', token })).status).toBe(204)
    expect(await prisma.mediaEntry.count()).toBe(0)
  })

  test('400 si faltan datos obligatorios', async () => {
    const { token } = await registerUser('Ana', 'ana@correo.com')
    const res = await api('/media', { method: 'POST', token, body: { type: 'movie', externalId: 'tmdb:1' } })
    expect(res.status).toBe(400)
  })
})

describe('GET /reviews', () => {
  test('muestra la reseña de otra persona con su calificación', async () => {
    const ana = await registerUser('Ana', 'ana@correo.com')
    const beto = await registerUser('Beto', 'beto@correo.com')
    await api('/media', { method: 'POST', token: ana.token, body: dune })

    const res = await api('/reviews?type=movie&externalId=tmdb:438631&title=Dune', { token: beto.token })
    expect(res.status).toBe(200)
    expect(res.body.average).toBe(4.5)
    expect(res.body.reviews).toHaveLength(1)
    expect(res.body.reviews[0]).toMatchObject({ review: 'Una obra maestra visual.', user: { name: 'Ana' } })
  })

  test('no incluye la reseña propia', async () => {
    const ana = await registerUser('Ana', 'ana@correo.com')
    await api('/media', { method: 'POST', token: ana.token, body: dune })

    const res = await api('/reviews?type=movie&externalId=tmdb:438631', { token: ana.token })
    expect(res.body).toEqual({ average: null, ratingCount: 0, reviews: [] })
  })
})
