import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { db, resetDb } from '../helpers/prisma'
import { authHeader, body as bodyOf, fakeUser, json } from '../helpers/auth'
import { hashPassword } from '../../src/lib/auth'

// Los correos no se mandan en las pruebas.
const sendVerificationEmail = mock(async () => {})
const requestPasswordReset = mock(async () => {})
const resetPassword = mock(async (): Promise<unknown> => null)
mock.module('../../src/lib/emailVerification', () => ({
  sendVerificationEmail,
  resendWaitMs: () => 0,
  verifyEmailToken: async () => null,
}))
const requestEmailChange = mock(async () => {})
mock.module('../../src/lib/emailChange', () => ({
  requestEmailChange,
  emailChangeWaitMs: () => 0,
  confirmEmailChange: async () => ({ ok: false, reason: 'invalid' }),
}))
mock.module('../../src/lib/passwordReset', () => ({
  requestPasswordReset,
  resetPassword,
  setPassword: async (user: object) => ({ ...user, sessionVersion: 1 }),
}))

const { authRoutes } = await import('../../src/routes/auth')

beforeEach(() => {
  resetDb()
  sendVerificationEmail.mockClear()
  requestPasswordReset.mockClear()
  requestEmailChange.mockClear()
})

describe('POST /auth/register', () => {
  const body = { name: 'Ana', email: 'Ana@Correo.com', password: 'secreta123' }

  test('crea la cuenta, devuelve token y manda el correo de verificación', async () => {
    const res = await authRoutes.request('/register', json(body))
    expect(res.status).toBe(201)
    const data = await bodyOf(res)
    expect(data.token).toBeString()
    expect(data.user).toMatchObject({ name: 'Ana', email: 'ana@correo.com' })

    const created = db.user.create.mock.calls[0]![0].data
    expect(created.passwordHash).not.toBe('secreta123') // se guarda el hash, no la contraseña
    expect(created.profile.create.handle).toBe('ana')
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1)
  })

  test('409 si el correo ya está registrado', async () => {
    db.user.findUnique.mockResolvedValueOnce(fakeUser())
    const res = await authRoutes.request('/register', json(body))
    expect(res.status).toBe(409)
    expect(db.user.create).not.toHaveBeenCalled()
  })

  test('400 con el campo que falló si los datos no son válidos', async () => {
    const res = await authRoutes.request('/register', json({ ...body, password: '123' }))
    expect(res.status).toBe(400)
    expect(await bodyOf(res)).toMatchObject({ field: 'password' })
  })

  test('429 si la misma IP se registra demasiadas veces', async () => {
    db.rateLimit.updateMany.mockResolvedValueOnce({ count: 1 })
    db.rateLimit.findUnique.mockResolvedValueOnce({ count: 11, resetAt: new Date(Date.now() + 60_000) })
    const res = await authRoutes.request('/register', json(body))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })
})

describe('POST /auth/login', () => {
  test('entra con la contraseña correcta', async () => {
    db.user.findUnique.mockResolvedValueOnce(fakeUser({ passwordHash: await hashPassword('secreta123') }))
    const res = await authRoutes.request('/login', json({ email: 'ANA@correo.com', password: 'secreta123' }))
    expect(res.status).toBe(200)
    expect((await bodyOf(res)).token).toBeString()
    expect(db.rateLimit.deleteMany).toHaveBeenCalled() // reinicia el contador de fallos
  })

  test('401 con contraseña incorrecta y suma un intento fallido', async () => {
    db.user.findUnique.mockResolvedValueOnce(fakeUser({ passwordHash: await hashPassword('secreta123') }))
    const res = await authRoutes.request('/login', json({ email: 'ana@correo.com', password: 'mala' }))
    expect(res.status).toBe(401)
    expect(await bodyOf(res)).toEqual({ message: 'Correo o contraseña incorrectos.' })
  })

  test('401 con el mismo mensaje si la cuenta no existe', async () => {
    const res = await authRoutes.request('/login', json({ email: 'nadie@correo.com', password: 'secreta123' }))
    expect(res.status).toBe(401)
    expect(await bodyOf(res)).toEqual({ message: 'Correo o contraseña incorrectos.' })
  })

  test('429 tras demasiados intentos fallidos con ese correo', async () => {
    db.rateLimit.findUnique.mockResolvedValueOnce({ count: 10, resetAt: new Date(Date.now() + 60_000) })
    const res = await authRoutes.request('/login', json({ email: 'ana@correo.com', password: 'secreta123' }))
    expect(res.status).toBe(429)
  })
})

describe('GET /auth/me', () => {
  test('401 sin token', async () => {
    expect((await authRoutes.request('/me')).status).toBe(401)
  })

  test('401 si la sesión se cerró (cambió la versión de sesión)', async () => {
    const headers = await authHeader()
    db.user.findUnique.mockReset()
    db.user.findUnique.mockResolvedValueOnce({ sessionVersion: 1 })
    const res = await authRoutes.request('/me', { headers })
    expect(res.status).toBe(401)
  })

  test('devuelve el usuario sin datos sensibles', async () => {
    const headers = await authHeader()
    db.user.findUnique.mockResolvedValueOnce(fakeUser({ passwordHash: 'hash-secreto' }))
    const res = await authRoutes.request('/me', { headers })
    expect(res.status).toBe(200)
    const { user } = await bodyOf(res)
    expect(user.email).toBe('ana@correo.com')
    expect(user).not.toHaveProperty('passwordHash')
  })
})

describe('recuperar contraseña', () => {
  test('forgot-password responde lo mismo exista o no la cuenta', async () => {
    const res = await authRoutes.request('/forgot-password', json({ email: 'nadie@correo.com' }))
    expect(res.status).toBe(200)
    expect(requestPasswordReset).toHaveBeenCalledWith('nadie@correo.com')
  })

  test('reset-password con enlace inválido da 400', async () => {
    const res = await authRoutes.request('/reset-password', json({ token: 'x', password: 'nueva12345' }))
    expect(res.status).toBe(400)
  })

  test('reset-password con enlace válido cambia la contraseña', async () => {
    resetPassword.mockResolvedValueOnce(fakeUser())
    const res = await authRoutes.request('/reset-password', json({ token: 'x', password: 'nueva12345' }))
    expect(res.status).toBe(200)
  })
})

describe('POST /auth/change-password', () => {
  test('400 si la contraseña actual no es correcta', async () => {
    const headers = await authHeader()
    db.user.findUnique.mockResolvedValueOnce(fakeUser({ passwordHash: await hashPassword('secreta123') }))
    const res = await authRoutes.request('/change-password', {
      method: 'POST',
      headers,
      body: JSON.stringify({ currentPassword: 'mala', newPassword: 'nueva12345' }),
    })
    expect(res.status).toBe(400)
    expect(await bodyOf(res)).toMatchObject({ field: 'currentPassword' })
  })

  test('cambia la contraseña y devuelve un token nuevo', async () => {
    const headers = await authHeader()
    db.user.findUnique.mockResolvedValueOnce(fakeUser({ passwordHash: await hashPassword('secreta123') }))
    const res = await authRoutes.request('/change-password', {
      method: 'POST',
      headers,
      body: JSON.stringify({ currentPassword: 'secreta123', newPassword: 'nueva12345' }),
    })
    expect(res.status).toBe(200)
    expect((await bodyOf(res)).token).toBeString()
  })
})

describe('DELETE /auth/account', () => {
  const del = (headers: Record<string, string>, confirm = 'ELIMINAR') => ({
    method: 'DELETE',
    headers,
    body: JSON.stringify({ confirm }),
  })

  test('pide escribir ELIMINAR', async () => {
    const res = await authRoutes.request('/account', del(await authHeader(), 'si'))
    expect(res.status).toBe(400)
  })

  test('el único admin no puede borrar su cuenta', async () => {
    const headers = await authHeader()
    db.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN' })
    db.user.count.mockResolvedValueOnce(1)
    const res = await authRoutes.request('/account', del(headers))
    expect(res.status).toBe(400)
    expect(db.user.delete).not.toHaveBeenCalled()
  })

  test('borra la cuenta de un usuario normal', async () => {
    const headers = await authHeader()
    db.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'USER' })
    const res = await authRoutes.request('/account', del(headers))
    expect(res.status).toBe(204)
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
  })
})

describe('verificación y cambio de correo', () => {
  test('verify-email con enlace inválido da 400', async () => {
    const res = await authRoutes.request('/verify-email', json({ token: 'x' }))
    expect(res.status).toBe(400)
  })

  test('resend-verification: 400 si el correo ya está verificado', async () => {
    const headers = await authHeader()
    db.user.findUnique.mockResolvedValueOnce(fakeUser({ emailVerifiedAt: new Date() }))
    const res = await authRoutes.request('/resend-verification', { method: 'POST', headers })
    expect(res.status).toBe(400)
  })

  test('resend-verification manda otro enlace', async () => {
    const headers = await authHeader()
    db.user.findUnique.mockResolvedValueOnce(fakeUser())
    const res = await authRoutes.request('/resend-verification', { method: 'POST', headers })
    expect(res.status).toBe(200)
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1)
  })

  test('change-email: 400 si es el mismo correo', async () => {
    const headers = await authHeader()
    db.user.findUnique.mockResolvedValueOnce(fakeUser({ passwordHash: await hashPassword('secreta123') }))
    const res = await authRoutes.request('/change-email', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'ana@correo.com', password: 'secreta123' }),
    })
    expect(res.status).toBe(400)
    expect(await bodyOf(res)).toMatchObject({ field: 'email' })
  })

  test('change-email manda el enlace al correo nuevo', async () => {
    const headers = await authHeader()
    const user = fakeUser({ passwordHash: await hashPassword('secreta123') })
    db.user.findUnique.mockResolvedValueOnce(user)
    db.user.findUniqueOrThrow.mockResolvedValueOnce({ ...user, pendingEmail: 'nuevo@correo.com' })
    const res = await authRoutes.request('/change-email', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'nuevo@correo.com', password: 'secreta123' }),
    })
    expect(res.status).toBe(200)
    expect(requestEmailChange).toHaveBeenCalledTimes(1)
    expect((await bodyOf(res)).user.pendingEmail).toBe('nuevo@correo.com')
  })

  test('confirm-email-change con enlace inválido da 400', async () => {
    const res = await authRoutes.request('/confirm-email-change', json({ token: 'x' }))
    expect(res.status).toBe(400)
  })
})
