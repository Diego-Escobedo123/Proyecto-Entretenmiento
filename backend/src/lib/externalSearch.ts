/**
 * Búsqueda contra catálogos externos, uno por tipo de obra. Se usa para
 * autocompletar el formulario de alta y para poblar /discover con datos reales.
 *
 * Proveedores (todos con tier gratuito):
 * - movie:  TMDB         (requiere TMDB_API_KEY)
 * - series: TMDB         (misma key)
 * - book:  Google Books  (sin key)
 * - game:  RAWG          (requiere RAWG_API_KEY)
 * - music: iTunes Search (sin key)
 *
 * Si falta la key de un proveedor, esa búsqueda vuelve `available: false` en
 * vez de romper: el resto de la app sigue funcionando sin esa fuente.
 */
export type MediaKind = 'movie' | 'series' | 'book' | 'game' | 'music'

export interface ExternalResult {
  externalId: string
  title: string
  creator: string
  year: number | null
  cover: string | null
  genres: string[]
}

export interface ExternalSearchResponse {
  available: boolean
  results: ExternalResult[]
}

const TIMEOUT_MS = 6000

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`${url} -> ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

// ---- TMDB (películas y series) ---------------------------------------

type TmdbKind = 'movie' | 'tv'

const tmdbGenreCache = new Map<TmdbKind, Map<number, string>>()

async function tmdbGenres(apiKey: string, kind: TmdbKind): Promise<Map<number, string>> {
  const cached = tmdbGenreCache.get(kind)
  if (cached) return cached
  const data = (await fetchJson(
    `https://api.themoviedb.org/3/genre/${kind}/list?api_key=${apiKey}&language=es-ES`,
  )) as { genres?: { id: number; name: string }[] }
  const genres = new Map((data.genres ?? []).map((g) => [g.id, g.name]))
  tmdbGenreCache.set(kind, genres)
  return genres
}

/** TMDB usa `title`/`release_date` en películas y `name`/`first_air_date` en series. */
interface TmdbResult {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  genre_ids?: number[]
}

async function searchTmdb(kind: TmdbKind, query: string): Promise<ExternalSearchResponse> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return { available: false, results: [] }

  const [genres, data] = await Promise.all([
    tmdbGenres(apiKey, kind),
    fetchJson(
      `https://api.themoviedb.org/3/search/${kind}?api_key=${apiKey}&language=es-ES&query=${encodeURIComponent(query)}`,
    ) as Promise<{ results?: TmdbResult[] }>,
  ])

  const results = (data.results ?? [])
    .filter((m) => m.title ?? m.name)
    .slice(0, 10)
    .map((m) => {
      const date = m.release_date || m.first_air_date
      return {
        // Prefijo distinto: en TMDB el mismo id numérico puede ser película y serie.
        externalId: `${kind === 'movie' ? 'tmdb' : 'tmdb-tv'}:${m.id}`,
        title: (m.title ?? m.name)!,
        creator: '',
        year: date ? Number(date.slice(0, 4)) : null,
        cover: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
        genres: (m.genre_ids ?? []).map((id) => genres.get(id)).filter((g): g is string => Boolean(g)),
      }
    })

  return { available: true, results }
}

// ---- Google Books (libros) --------------------------------------------

/**
 * Google Books sólo entrega un `thumbnail` de 128x192 (borroso al escalarlo).
 * Su servidor de imágenes acepta `fife=w<ancho>` y devuelve la portada a esa
 * resolución; también quitamos `edge=curl` (la esquina doblada). Otras URLs
 * se devuelven tal cual, así que es seguro aplicarlo a cualquier portada.
 */
export function upgradeBookCover(url: string | null): string | null {
  if (!url || !/^https?:\/\/books\.google(usercontent)?\.[^/]+\/books\/(content|publisher)/.test(url)) return url
  return (
    url
      .replace(/^http:/, 'https:')
      .replace(/&edge=curl/, '')
      .replace(/&fife=[^&]*/, '') + '&fife=w800'
  )
}

async function searchBooks(query: string): Promise<ExternalSearchResponse> {
  // Sin key, la cuota compartida de Google Books rate-limita rápido (429).
  // Con GOOGLE_BOOKS_API_KEY (opcional, gratis) la cuota es individual.
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  const keyParam = apiKey ? `&key=${apiKey}` : ''

  try {
    const data = (await fetchJson(
      `https://www.googleapis.com/books/v1/volumes?maxResults=10&q=${encodeURIComponent(query)}${keyParam}`,
    )) as {
      items?: {
        id: string
        volumeInfo?: {
          title?: string
          authors?: string[]
          publishedDate?: string
          imageLinks?: { thumbnail?: string }
          categories?: string[]
        }
      }[]
    }

    const results = (data.items ?? [])
      .filter((item) => item.volumeInfo?.title)
      .map((item) => {
        const info = item.volumeInfo!
        return {
          externalId: `googlebooks:${item.id}`,
          title: info.title!,
          creator: info.authors?.join(', ') ?? '',
          year: info.publishedDate ? Number(info.publishedDate.slice(0, 4)) : null,
          cover: upgradeBookCover(info.imageLinks?.thumbnail ?? null),
          genres: info.categories ?? [],
        }
      })

    return { available: true, results }
  } catch (err) {
    // Cuota agotada u otro fallo transitorio: se trata como "no disponible",
    // igual que un proveedor sin key, en vez de tumbar la búsqueda.
    console.error('search/book:', err)
    return { available: false, results: [] }
  }
}

// ---- RAWG (juegos) ------------------------------------------------------

async function searchGames(query: string): Promise<ExternalSearchResponse> {
  const apiKey = process.env.RAWG_API_KEY
  if (!apiKey) return { available: false, results: [] }

  const data = (await fetchJson(
    `https://api.rawg.io/api/games?key=${apiKey}&page_size=10&search=${encodeURIComponent(query)}`,
  )) as {
    results?: { id: number; name: string; released?: string | null; background_image?: string | null; genres?: { name: string }[] }[]
  }

  const results = (data.results ?? []).map((g) => ({
    externalId: `rawg:${g.id}`,
    title: g.name,
    creator: '',
    year: g.released ? Number(g.released.slice(0, 4)) : null,
    cover: g.background_image ?? null,
    genres: (g.genres ?? []).map((x) => x.name),
  }))

  return { available: true, results }
}

// ---- iTunes Search (música) ---------------------------------------------

async function searchMusic(query: string): Promise<ExternalSearchResponse> {
  const data = (await fetchJson(
    `https://itunes.apple.com/search?entity=album&limit=10&term=${encodeURIComponent(query)}`,
  )) as {
    results?: {
      collectionId: number
      collectionName?: string
      artistName?: string
      releaseDate?: string
      artworkUrl100?: string
      primaryGenreName?: string
    }[]
  }

  const results = (data.results ?? [])
    .filter((r) => r.collectionName)
    .map((r) => ({
      externalId: `itunes:${r.collectionId}`,
      title: r.collectionName!,
      creator: r.artistName ?? '',
      year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null,
      cover: r.artworkUrl100 ? r.artworkUrl100.replace('100x100', '600x600') : null,
      genres: r.primaryGenreName ? [r.primaryGenreName] : [],
    }))

  return { available: true, results }
}

export async function searchExternal(type: MediaKind | string, query: string): Promise<ExternalSearchResponse> {
  switch (type) {
    case 'movie':
      return searchTmdb('movie', query)
    case 'series':
      return searchTmdb('tv', query)
    case 'book':
      return searchBooks(query)
    case 'game':
      return searchGames(query)
    case 'music':
      return searchMusic(query)
    default:
      return { available: false, results: [] }
  }
}
