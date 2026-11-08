import { afterEach, describe, expect, test } from 'bun:test'
import { getWorkDetails, sophosLink } from '../../src/lib/workDetails'

const realFetch = globalThis.fetch

/** Responde con el JSON que toque según la URL, sin salir a internet. */
function mockFetch(routes: Record<string, unknown>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    const match = Object.keys(routes).find((part) => url.includes(part))
    if (!match) return new Response('not found', { status: 404 })
    return new Response(JSON.stringify(routes[match]), { status: 200 })
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('sophosLink', () => {
  test('busca por título y autor en la tienda de Sophos, marcado como de Mosaic', () => {
    const link = sophosLink('Rayuela', 'Julio Cortázar')
    const url = new URL(link.url)
    expect(link.name).toBe('Sophos')
    expect(url.origin + url.pathname).toBe('https://tienda.sophosenlinea.com/busqueda/listaLibros.php')
    expect(url.searchParams.get('palabrasBusqueda')).toBe('Rayuela Julio Cortázar')
    // Sin estos dos, el buscador de Sophos no devuelve resultados.
    expect(url.searchParams.get('tipoBus')).toBe('full')
    expect(url.searchParams.get('aproximada')).toBe('N')
    expect(url.searchParams.get('ref')).toBe('mosaic')
  })

  test('sólo aplica en Guatemala', () => {
    expect(sophosLink('Rayuela').onlyIn).toBe('GT')
  })

  test('sin autor busca sólo por el título', () => {
    const url = new URL(sophosLink('El principito').url)
    expect(url.searchParams.get('palabrasBusqueda')).toBe('El principito')
  })
})

describe('getWorkDetails: dónde comprar un libro', () => {
  test('Google Books: Sophos va primero y ya no aparece Goodreads', async () => {
    mockFetch({
      'googleapis.com/books/v1/volumes/': {
        volumeInfo: { title: 'Rayuela', authors: ['Julio Cortázar'] },
      },
    })
    const details = await getWorkDetails('googlebooks:test-rayuela', 'GT')
    const names = details?.where?.groups[0]?.items.map((i) => i.name)
    expect(names).toEqual(['Sophos', 'Google Play Libros', 'Amazon'])
    expect(names).not.toContain('Goodreads')
  })

  test('Open Library: Sophos va primero y ya no aparece Goodreads', async () => {
    mockFetch({
      '/editions.json': { entries: [] },
      'openlibrary.org/works/': { title: 'Rayuela' },
    })
    const details = await getWorkDetails('openlibrary:OLtestW', 'GT')
    const names = details?.where?.groups[0]?.items.map((i) => i.name)
    expect(names).toEqual(['Sophos', 'Open Library', 'Amazon'])
  })
})
