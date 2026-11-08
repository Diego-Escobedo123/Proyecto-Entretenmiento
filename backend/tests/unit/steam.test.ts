import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import '../helpers/prisma'
import { resetRawgStatus, searchExternal, withRawgFallback } from '../../src/lib/externalSearch'
import { clearSteamCache, isSuitable, steamReleaseDay } from '../../src/lib/steam'
import { getWorkDetails } from '../../src/lib/workDetails'

const { clearExploreCache, getSection } = await import('../../src/lib/explore')

const realFetch = globalThis.fetch
const realKey = process.env.RAWG_API_KEY
let rawgCalls = 0

const game = (name: string, extra: object = {}) => ({
  type: 'game',
  name,
  developers: ['  Estudio '],
  genres: [{ description: 'Acción' }],
  release_date: { coming_soon: false, date: '24 FEB 2017' },
  header_image: `https://cdn.example/${name}.jpg`,
  short_description: `Sinopsis de ${name}`,
  ...extra,
})

/** Steam simulado, con RAWG caído (522). */
function steamUp(apps: Record<number, object | null>, listIds: number[] = Object.keys(apps).map(Number)) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('api.rawg.io')) {
      rawgCalls++
      return new Response('origin down', { status: 522 })
    }
    if (url.includes('library_600x900')) return new Response(null, { status: 404 })
    if (url.includes('/appdetails')) {
      const id = Number(new URL(url).searchParams.get('appids'))
      const data = apps[id]
      return Response.json({ [id]: data ? { success: true, data } : { success: false } })
    }
    const items = listIds.map((id) => ({ id }))
    if (url.includes('/storesearch')) return Response.json({ items })
    if (url.includes('/featuredcategories')) return Response.json({ top_sellers: { items }, specials: { items: [] } })
    return new Response('not found', { status: 404 })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  process.env.RAWG_API_KEY = 'clave-de-prueba'
  rawgCalls = 0
  resetRawgStatus()
  clearSteamCache()
  clearExploreCache()
})

afterEach(() => {
  globalThis.fetch = realFetch
  process.env.RAWG_API_KEY = realKey
})

describe('steamReleaseDay', () => {
  test('convierte la fecha en español de Steam', () => {
    expect(steamReleaseDay('24 FEB 2017')).toBe('2017-02-24')
    expect(steamReleaseDay('5 ENE 2025')).toBe('2025-01-05')
    expect(steamReleaseDay('12 AGO 2016')).toBe('2016-08-12')
  })

  test('otros formatos no dan fecha', () => {
    expect(steamReleaseDay('T1 2027')).toBeUndefined()
    expect(steamReleaseDay('Próximamente')).toBeUndefined()
    expect(steamReleaseDay(undefined)).toBeUndefined()
  })
})

describe('isSuitable', () => {
  test('un juego normal sí, aunque sea violento (Call of Duty)', () => {
    expect(isSuitable(game('A', { required_age: 17, content_descriptors: { ids: [2, 5] } }))).toBe(true)
  })

  test('hardware como el Steam Deck no', () => {
    expect(isSuitable(game('Steam Deck', { type: 'hardware' }))).toBe(false)
  })

  test('bandas sonoras y expansiones no', () => {
    expect(isSuitable(game('OST', { type: 'music' }))).toBe(false)
    expect(isSuitable(game('DLC', { type: 'dlc' }))).toBe(false)
  })

  test('contenido sexual o para mayores de 18 no', () => {
    for (const id of [1, 3, 4]) {
      expect(isSuitable(game('A', { content_descriptors: { ids: [id] } }))).toBe(false)
    }
    expect(isSuitable(game('A', { required_age: '18' }))).toBe(false)
  })
})

describe('withRawgFallback', () => {
  test('si RAWG responde, no usa el respaldo', async () => {
    expect(await withRawgFallback(async () => 'rawg', async () => 'steam')).toBe('rawg')
  })

  test('si RAWG falla, usa el respaldo y no le vuelve a preguntar', async () => {
    let calls = 0
    const rawg = async () => {
      calls++
      throw new Error('522')
    }
    expect(await withRawgFallback(rawg, async () => 'steam')).toBe('steam')
    expect(await withRawgFallback(rawg, async () => 'steam')).toBe('steam')
    expect(calls).toBe(1)
  })

  test('sin key de RAWG va directo al respaldo', async () => {
    delete process.env.RAWG_API_KEY
    let calls = 0
    const rawg = async () => {
      calls++
      return 'rawg'
    }
    expect(await withRawgFallback(rawg, async () => 'steam')).toBe('steam')
    expect(calls).toBe(0)
  })
})

describe('búsqueda de juegos con RAWG caído', () => {
  test('busca en Steam, sin hardware ni contenido para adultos', async () => {
    steamUp({
      1: game('Hollow Knight'),
      2: game('Hollow Knight Deck', { type: 'hardware' }),
      3: game('Hollow Knight Adulto', { content_descriptors: { ids: [3] } }),
    })
    const res = await searchExternal('game', 'hollow knight')
    expect(res.available).toBe(true)
    expect(res.results.map((r) => r.title)).toEqual(['Hollow Knight'])
    expect(res.results[0]).toMatchObject({
      externalId: 'steam:1',
      creator: 'Estudio',
      year: 2017,
      genres: ['Acción'],
      cover: 'https://cdn.example/Hollow Knight.jpg',
    })
  })

  test('quita los que no tienen las palabras buscadas', async () => {
    steamUp({ 1: game('Stardew Valley'), 2: game('Artificial Life 2061') })
    const res = await searchExternal('game', 'stardew')
    expect(res.results.map((r) => r.title)).toEqual(['Stardew Valley'])
  })

  test('la segunda búsqueda ya no le pregunta a RAWG', async () => {
    steamUp({ 1: game('Celeste') })
    await searchExternal('game', 'celeste')
    const callsAfterFirst = rawgCalls
    await searchExternal('game', 'celeste')
    expect(callsAfterFirst).toBeGreaterThan(0)
    expect(rawgCalls).toBe(callsAfterFirst)
  })
})

describe('Explorar juegos con RAWG caído', () => {
  const options = { region: 'GT', userId: 'u1' }

  test('Tendencias salen de lo más vendido de Steam, sin hardware', async () => {
    steamUp({ 1: game('Rust'), 2: game('Steam Frame', { type: 'hardware' }) })
    const items = await getSection('trending', 'game', options)
    expect(items.map((i) => i.title)).toEqual(['Rust'])
    expect(items[0].type).toBe('game')
  })

  test('Estrenos sólo trae lo próximo o reciente', async () => {
    const soon = new Date(Date.now() + 5 * 86_400_000)
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
    const date = `${soon.getDate()} ${months[soon.getMonth()]} ${soon.getFullYear()}`
    steamUp({ 1: game('Viejo'), 2: game('Nuevo', { release_date: { coming_soon: true, date } }) })
    const items = await getSection('upcoming', 'game', options)
    expect(items.map((i) => i.title)).toEqual(['Nuevo'])
    expect(items[0].note).toStartWith('Sale el')
  })

  test('Joyas trae sinopsis y Metacritic', async () => {
    steamUp({ 504230: game('Celeste', { metacritic: { score: 88 } }) }, [])
    const items = await getSection('gems', 'game', options)
    expect(items.map((i) => i.title)).toEqual(['Celeste'])
    expect(items[0]).toMatchObject({ note: 'Metacritic 88', description: 'Sinopsis de Celeste' })
  })
})

describe('ficha de un juego de Steam', () => {
  test('trae plataformas, estudio y enlace a la tienda', async () => {
    steamUp({
      77: game('Celeste', {
        platforms: { windows: true, mac: true, linux: false },
        metacritic: { score: 88 },
        publishers: ['Editora'],
      }),
    })
    const d = await getWorkDetails('steam:77', 'GT')
    expect(d?.overview).toBe('Sinopsis de Celeste')
    expect(d?.platforms).toEqual(['PC', 'macOS'])
    expect(d?.facts).toEqual(['PC, macOS', 'Metacritic 88'])
    expect(d?.where?.groups[0].items[0].url).toBe('https://store.steampowered.com/app/77')
  })

  test('un id que no es número no consulta nada', async () => {
    expect(await getWorkDetails('steam:abc', 'GT')).toBeNull()
  })
})
