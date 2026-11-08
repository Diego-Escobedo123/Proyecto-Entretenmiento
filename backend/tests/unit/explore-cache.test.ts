import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import '../helpers/prisma'

const { cached, clearExploreCache, getSection } = await import('../../src/lib/explore')
const { resetRawgStatus } = await import('../../src/lib/externalSearch')
const { clearSteamCache } = await import('../../src/lib/steam')

const realFetch = globalThis.fetch
let fetchCalls = 0

/** Simula un catálogo caído: cada pedido responde 522, como RAWG cuando falla. */
function catalogDown() {
  globalThis.fetch = (async () => {
    fetchCalls++
    return new Response('origin down', { status: 522 })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  clearExploreCache()
  clearSteamCache()
  resetRawgStatus()
  fetchCalls = 0
  process.env.RAWG_API_KEY = 'clave-de-prueba'
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('Explorar con un catálogo caído', () => {
  test('la segunda visita no vuelve a esperar al catálogo que falló', async () => {
    catalogDown()
    const options = { region: 'GT', userId: 'u1' }

    expect(await getSection('gems', 'game', options)).toEqual([])
    const callsAfterFirstVisit = fetchCalls
    expect(callsAfterFirstVisit).toBeGreaterThan(0)

    expect(await getSection('gems', 'game', options)).toEqual([])
    expect(fetchCalls).toBe(callsAfterFirstVisit)
  })
})

describe('cached', () => {
  const item = { type: 'book' as const, externalId: 'x:1', title: 'Rayuela', creator: '', year: null, cover: null, genres: [] }

  test('sin emptyTtl, un resultado vacío no se guarda y se reintenta', async () => {
    let loads = 0
    const load = async () => {
      loads++
      return []
    }
    await cached('k-sin-ttl', 60_000, load)
    await cached('k-sin-ttl', 60_000, load)
    expect(loads).toBe(2)
  })

  test('con emptyTtl, un resultado vacío se guarda ese tiempo', async () => {
    let loads = 0
    const load = async () => {
      loads++
      return []
    }
    await cached('k-con-ttl', 60_000, load, 60_000)
    await cached('k-con-ttl', 60_000, load, 60_000)
    expect(loads).toBe(1)
  })

  test('un resultado con obras se guarda por el ttl normal', async () => {
    let loads = 0
    const load = async () => {
      loads++
      return [item]
    }
    expect(await cached('k-obras', 60_000, load)).toEqual([item])
    expect(await cached('k-obras', 60_000, load)).toEqual([item])
    expect(loads).toBe(1)
  })
})
