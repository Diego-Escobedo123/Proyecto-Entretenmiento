import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import '../helpers/prisma'
import { detectLanguage, findBookEdition, rankBooksByLanguage, searchExternal, type GoogleBook } from '../../src/lib/externalSearch'
import { getWorkDetails } from '../../src/lib/workDetails'

const { clearExploreCache, getSection } = await import('../../src/lib/explore')

const realFetch = globalThis.fetch

const ES = 'Una novela sobre el sueño de un hombre que vive en la ciudad y que busca el amor de su vida para siempre.'
const EN = 'A novel about the dream of a man who lives in the city and is looking for the love of his life with all of his heart.'
const SK = 'Nevinné lži. Drsný humor. Fatálne následky. June Haywardová a Athena Liu sú vychádzajúce literárne talenty a Athena je miláčikom.'

let uniqueId = 0
const book = (title: string, language: string, extra: Partial<NonNullable<GoogleBook['volumeInfo']>> = {}): GoogleBook => ({
  id: `b${++uniqueId}`,
  volumeInfo: { title, language, authors: ['Ana Autora'], imageLinks: { thumbnail: 'http://x/c.jpg' }, ...extra },
})

/** Google Books y Open Library simulados, sin salir a internet. */
function mockCatalogs(routes: { search?: GoogleBook[] | null; volume?: GoogleBook; openLibrary?: Record<string, unknown> }) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('googleapis.com/books/v1/volumes?')) {
      if (routes.search === null) return new Response('quota', { status: 429 })
      return Response.json({ items: routes.search ?? [] })
    }
    if (url.includes('googleapis.com/books/v1/volumes/')) return Response.json(routes.volume ?? {})
    for (const [part, body] of Object.entries(routes.openLibrary ?? {})) {
      if (url.includes(part)) return Response.json(body)
    }
    return new Response('not found', { status: 404 })
  }) as unknown as typeof fetch
}

beforeEach(clearExploreCache)
afterEach(() => {
  globalThis.fetch = realFetch
})

describe('detectLanguage', () => {
  test('reconoce español e inglés', () => {
    expect(detectLanguage(ES)).toBe('es')
    expect(detectLanguage(EN)).toBe('en')
  })

  test('otros idiomas no cuentan como español ni inglés', () => {
    expect(detectLanguage(SK)).toBeNull()
  })

  test('un texto muy corto o vacío no se puede saber', () => {
    expect(detectLanguage('El libro')).toBeNull()
    expect(detectLanguage('')).toBeNull()
  })
})

describe('rankBooksByLanguage', () => {
  const titles = (items: GoogleBook[]) => items.map((b) => b.volumeInfo!.title)

  test('español primero, después inglés y al final los demás, sin esconder ninguno', () => {
    const items = [book('Eslovaco', 'sk'), book('Inglés', 'en'), book('Español', 'es'), book('Danés', 'da')]
    expect(titles(rankBooksByLanguage(items))).toEqual(['Español', 'Inglés', 'Eslovaco', 'Danés'])
  })

  test('un resumen en español sin portada no tapa al libro real en inglés', () => {
    const items = [book('Resumen', 'es', { imageLinks: undefined }), book('Atomic Habits', 'en')]
    expect(titles(rankBooksByLanguage(items))).toEqual(['Atomic Habits', 'Resumen'])
  })

  test('entiende variantes como es-419', () => {
    expect(titles(rankBooksByLanguage([book('Inglés', 'en'), book('Latino', 'es-419')]))).toEqual(['Latino', 'Inglés'])
  })
})

describe('búsqueda de libros', () => {
  test('quien busca en inglés ve la edición en español y también las demás', async () => {
    mockCatalogs({ search: [book('The Great Gatsby', 'en'), book('Gatsby eslovaco', 'sk'), book('El gran Gatsby', 'es')] })
    const res = await searchExternal('book', 'the great gatsby')
    expect(res.results.map((r) => r.title)).toEqual(['El gran Gatsby', 'The Great Gatsby', 'Gatsby eslovaco'])
  })

  test('si Google Books falla, no rompe la búsqueda', async () => {
    mockCatalogs({ search: null })
    expect(await searchExternal('book', 'dune')).toEqual({ available: false, results: [] })
  })
})

describe('findBookEdition', () => {
  const es = { language: 'es' as const }

  test('elige la edición en ese idioma del mismo autor', async () => {
    mockCatalogs({ search: [book('Rich Dad', 'en'), book('Padre Rico', 'es', { subtitle: 'Rich Dad' })] })
    expect((await findBookEdition('Rich Dad', 'Ana Autora', es))?.volumeInfo?.title).toBe('Padre Rico')
  })

  test('no acepta otro libro del mismo autor sin palabras en común', async () => {
    mockCatalogs({ search: [book('Eres la protagonista de tu vida', 'es')] })
    expect(await findBookEdition('The Mountain Is You', 'Ana Autora', es)).toBeNull()
  })

  test('acepta el título original en el subtítulo y palabras parecidas', async () => {
    mockCatalogs({ search: [book('La paciente silenciosa', 'es', { subtitle: 'The Silent Patient' })] })
    expect((await findBookEdition('The Silent Patient', 'Ana Autora', es))?.volumeInfo?.title).toBe('La paciente silenciosa')
    mockCatalogs({ search: [book('El arte de la seducción', 'es')] })
    expect((await findBookEdition('The Art of Seduction', 'Ana Autora', es))?.volumeInfo?.title).toBe('El arte de la seducción')
  })

  test('no acepta otro autor', async () => {
    mockCatalogs({ search: [book('Rich Dad', 'es', { authors: ['Otra Persona'] })] })
    expect(await findBookEdition('Rich Dad', 'Ana Autora', es)).toBeNull()
  })

  test('sin portada no sirve para cambiar el libro completo', async () => {
    mockCatalogs({ search: [book('Rich Dad', 'es', { imageLinks: undefined })] })
    expect(await findBookEdition('Rich Dad', 'Ana Autora', es)).toBeNull()
  })

  test('estricto: no acepta otro libro de la misma saga', async () => {
    mockCatalogs({ search: [book('Harry Potter y la Orden del Fénix', 'es', { description: ES })] })
    expect(await findBookEdition("Harry Potter and the Philosopher's Stone", 'Ana Autora', { ...es, strict: true })).toBeNull()
  })

  test('estricto: entre varios, el de título más parecido', async () => {
    mockCatalogs({
      search: [
        book('Sapiens. Una historia gráfica 1', 'es', { description: ES }),
        book('Sapiens. De animales', 'es', { description: ES }),
      ],
    })
    const found = await findBookEdition('Sapiens', 'Ana Autora', { ...es, strict: true })
    expect(found?.volumeInfo?.title).toBe('Sapiens. De animales')
  })

  test('estricto: la sinopsis tiene que estar de verdad en ese idioma', async () => {
    mockCatalogs({ search: [book('Yellowface', 'es', { description: SK })] })
    expect(await findBookEdition('Yellowface', 'Ana Autora', { ...es, strict: true })).toBeNull()
  })
})

describe('ficha de un libro', () => {
  const fromVolume = (description: string) => book('Yellowface', 'en', { description })

  test('una sinopsis en español se queda, sin consultar otras ediciones', async () => {
    mockCatalogs({ volume: fromVolume(ES), search: null })
    const d = await getWorkDetails(`googlebooks:es-${++uniqueId}`, 'GT')
    expect(d?.overview).toBe(ES)
  })

  test('una en inglés se cambia por la de una edición en español', async () => {
    const OTHER = `${ES} Y mucho más.`
    mockCatalogs({ volume: fromVolume(EN), search: [book('Yellowface', 'es', { description: OTHER })] })
    const d = await getWorkDetails(`googlebooks:en-${++uniqueId}`, 'GT')
    expect(d?.overview).toBe(OTHER)
    expect(d?.facts.join()).not.toContain('En inglés')
  })

  test('una en eslovaco, sin edición en español, se cambia por la de una en inglés', async () => {
    mockCatalogs({ volume: fromVolume(SK), search: [book('Yellowface', 'en', { description: EN })] })
    const d = await getWorkDetails(`googlebooks:sk-${++uniqueId}`, 'GT')
    expect(d?.overview).toBe(EN)
  })

  test('sin otra edición, queda la que había', async () => {
    mockCatalogs({ volume: fromVolume(EN), search: [] })
    const d = await getWorkDetails(`googlebooks:solo-${++uniqueId}`, 'GT')
    expect(d?.overview).toBe(EN)
    expect(d?.facts.join()).toContain('En inglés')
  })

  test('si Google Books falla al buscar, queda la que había', async () => {
    mockCatalogs({ volume: fromVolume(EN), search: null })
    const d = await getWorkDetails(`googlebooks:falla-${++uniqueId}`, 'GT')
    expect(d?.overview).toBe(EN)
  })

  test('Open Library: usa el autor de la obra para buscar en español', async () => {
    const id = `OL${++uniqueId}W`
    mockCatalogs({
      search: [book('Rayuela', 'es', { description: ES })],
      openLibrary: {
        '/editions.json': { entries: [] },
        '/authors/': { name: 'Ana Autora' },
        [`/works/${id}`]: { title: 'Rayuela', description: EN, authors: [{ author: { key: '/authors/OL1A' } }] },
      },
    })
    const d = await getWorkDetails(`openlibrary:${id}`, 'GT')
    expect(d?.overview).toBe(ES)
  })
})

describe('Explorar: tendencias de libros', () => {
  const options = { region: 'GT', userId: 'u1' }
  const trending = (works: object[]) => ({ '/trending/weekly.json': { works } })
  const work = (n: number, title: string) => ({ key: `/works/OL${n}W`, title, author_name: ['Ana Autora'], cover_i: n })

  test('sale la edición en español si existe; si no, el original', async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = decodeURIComponent(String(input))
      if (url.includes('/trending/weekly.json')) return Response.json(trending([work(1, 'Rich Dad'), work(2, 'Dune')])['/trending/weekly.json'])
      if (url.includes('volumes?')) return Response.json({ items: url.includes('Rich Dad') ? [book('Padre Rico', 'es', { subtitle: 'Rich Dad' })] : [book('Dune', 'en')] })
      return new Response('not found', { status: 404 })
    }) as unknown as typeof fetch
    const items = await getSection('trending', 'book', options)
    expect(items.map((i) => i.title)).toEqual(['Padre Rico', 'Dune'])
    expect(items[0].externalId).toStartWith('googlebooks:')
    expect(items[1].externalId).toBe('openlibrary:OL2W')
  })

  test('si Google Books falla, siguen saliendo las tendencias originales', async () => {
    mockCatalogs({ search: null, openLibrary: trending([work(3, 'Dune')]) })
    const items = await getSection('trending', 'book', options)
    expect(items.map((i) => i.title)).toEqual(['Dune'])
  })
})
