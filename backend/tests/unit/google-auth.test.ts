import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { sign } from 'hono/jwt'
import { isGoogleAuthEnabled, verifyGoogleIdToken } from '../../src/lib/auth'

/**
 * Inicio de sesión con Google: se firma un ID token con una llave de prueba y
 * se simula la respuesta de Google con sus llaves públicas (JWKS), así no se
 * llama a internet.
 */
const CLIENT_ID = 'mosaic-test.apps.googleusercontent.com'
let privateJwk: Parameters<typeof sign>[1]
let publicJwk: object

beforeAll(async () => {
  const keys = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const exported = await crypto.subtle.exportKey('jwk', keys.privateKey)
  privateJwk = { ...exported, kid: 'test-key', alg: 'RS256' } as Parameters<typeof sign>[1]
  publicJwk = { ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }
})

const fetchSpy = spyOn(globalThis, 'fetch')
afterEach(() => fetchSpy.mockReset())
afterAll(() => fetchSpy.mockRestore())

function googleToken(overrides: Record<string, unknown> = {}) {
  fetchSpy.mockResolvedValue(Response.json({ keys: [publicJwk] }))
  const now = Math.floor(Date.now() / 1000)
  return sign(
    {
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      iat: now,
      exp: now + 3600,
      email: 'Ana@Gmail.com',
      email_verified: true,
      name: 'Ana López',
      ...overrides,
    },
    privateJwk,
    'RS256',
  )
}

describe('verifyGoogleIdToken', () => {
  test('está activo cuando hay GOOGLE_CLIENT_ID', () => {
    expect(isGoogleAuthEnabled()).toBe(true)
  })

  test('acepta un token válido y deja el correo en minúsculas', async () => {
    expect(await verifyGoogleIdToken(await googleToken())).toEqual({ email: 'ana@gmail.com', name: 'Ana López' })
  })

  test('sin nombre usa la parte del correo antes de la @', async () => {
    const identity = await verifyGoogleIdToken(await googleToken({ name: '  ' }))
    expect(identity?.name).toBe('Ana')
  })

  test('rechaza un correo no verificado por Google', async () => {
    expect(await verifyGoogleIdToken(await googleToken({ email_verified: false }))).toBeNull()
  })

  test('rechaza un token emitido para otra app', async () => {
    expect(await verifyGoogleIdToken(await googleToken({ aud: 'otra-app' }))).toBeNull()
  })

  test('rechaza un token vencido', async () => {
    expect(await verifyGoogleIdToken(await googleToken({ exp: Math.floor(Date.now() / 1000) - 60 }))).toBeNull()
  })

  test('rechaza texto que no es un token', async () => {
    expect(await verifyGoogleIdToken('basura')).toBeNull()
  })
})
