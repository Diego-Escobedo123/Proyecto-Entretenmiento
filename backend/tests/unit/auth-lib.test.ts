import { describe, expect, test } from 'bun:test'
import { sign } from 'hono/jwt'
import { hashPassword, signToken, verifyPassword, verifyToken } from '../../src/lib/auth'
import { cooldownLeftMs, hashToken, newToken } from '../../src/lib/tokens'

describe('contraseñas', () => {
  test('el hash no guarda la contraseña en claro y se puede verificar', async () => {
    const hash = await hashPassword('secreta123')
    expect(hash).not.toContain('secreta123')
    expect(await verifyPassword('secreta123', hash)).toBe(true)
  })

  test('una contraseña distinta no pasa la verificación', async () => {
    const hash = await hashPassword('secreta123')
    expect(await verifyPassword('otra-cosa', hash)).toBe(false)
  })
})

describe('tokens de sesión (JWT)', () => {
  test('un token firmado se verifica y trae el id y la versión de sesión', async () => {
    const token = await signToken({ id: 'user-1', sessionVersion: 3 })
    const payload = await verifyToken(token)
    expect(payload?.sub).toBe('user-1')
    expect(payload?.ver).toBe(3)
    expect(payload!.exp).toBeGreaterThan(Date.now() / 1000)
  })

  test('un token alterado se rechaza', async () => {
    const token = await signToken({ id: 'user-1', sessionVersion: 0 })
    expect(await verifyToken(token.slice(0, -2) + 'xx')).toBeNull()
  })

  test('un token firmado con otra clave se rechaza', async () => {
    const exp = Math.floor(Date.now() / 1000) + 60
    const forged = await sign({ sub: 'user-1', ver: 0, exp }, 'otra-clave', 'HS256')
    expect(await verifyToken(forged)).toBeNull()
  })

  test('texto que no es un token se rechaza', async () => {
    expect(await verifyToken('no-soy-un-token')).toBeNull()
  })
})

describe('tokens de los enlaces por correo', () => {
  test('cada token es distinto y apto para URL', () => {
    const a = newToken()
    expect(a).not.toBe(newToken())
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  test('el hash es siempre el mismo para el mismo token (SHA-256)', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).toHaveLength(64)
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })

  test('la espera entre correos', () => {
    expect(cooldownLeftMs(null, 60_000)).toBe(0)
    expect(cooldownLeftMs(new Date(Date.now() - 120_000), 60_000)).toBe(0)
    expect(cooldownLeftMs(new Date(), 60_000)).toBeGreaterThan(50_000)
  })
})
