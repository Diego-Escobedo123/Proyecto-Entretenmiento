import { expect, type Page } from '@playwright/test'

export const API_URL = 'http://localhost:3100'

/** Usuario único por prueba, para que no choquen entre sí. */
export function newUser(name = 'Ana Prueba') {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  return { name, email: `e2e-${id}@mosaic.test`, password: 'secreta123' }
}

type User = ReturnType<typeof newUser>

/** Crea la cuenta directo en la API (más rápido que llenar el formulario). */
export async function createUser(page: Page, user: User = newUser()): Promise<User & { token: string }> {
  // IP inventada por usuario (ver backend/scripts/e2e-server.ts): sin esto el
  // límite de 10 registros por hora por IP frenaría las pruebas.
  const fakeIp = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
  const res = await page.request.post(`${API_URL}/auth/register`, {
    data: user,
    headers: { 'X-Forwarded-For': fakeIp },
  })
  expect(res.status(), await res.text()).toBe(201)
  const { token } = await res.json()
  return { ...user, token }
}

/** Abre la app con la sesión de ese usuario ya iniciada. */
export async function loginAs(page: Page, user: { token: string }, path = '/') {
  await page.addInitScript((token) => localStorage.setItem('mosaic:token', token), user.token)
  await page.goto(path)
}

/**
 * Catálogo falso: las búsquedas a TMDB / Google Books / RAWG pasan por el
 * backend (`/search`, `/details`). Se simulan para que las pruebas no dependan
 * de internet ni de API keys y den siempre el mismo resultado.
 */
export const DUNE = {
  externalId: 'tmdb:438631',
  title: 'Dune',
  creator: 'Denis Villeneuve',
  year: 2021,
  cover: null,
  genres: ['Ciencia ficción'],
}

export async function mockCatalog(page: Page) {
  await page.route(`${API_URL}/search?*`, async (route) => {
    const url = new URL(route.request().url())
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const isMovie = url.searchParams.get('type') === 'movie'
    const results = isMovie && 'dune'.startsWith(q.slice(0, 4)) ? [DUNE] : []
    await route.fulfill({ json: { available: true, results } })
  })
  await page.route(`${API_URL}/details?*`, (route) => route.fulfill({ json: null }))
}
