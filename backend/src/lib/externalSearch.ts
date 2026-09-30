/**
 * Búsqueda contra catálogos externos, uno por tipo de obra. Se usa para
 * autocompletar el formulario de alta y en Explorar. Los conversores
 * (`fromTmdb`, `fromRawg`, …) también los usa `explore.ts`, para que una obra
 * se vea igual venga de una búsqueda o de una sección de Explorar.
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
import { fetchJson } from './http'

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

const yearOf = (date?: string | null) => (date ? Number(date.slice(0, 4)) : null)

// ---- TMDB (películas y series) ---------------------------------------

export type TmdbKind = 'movie' | 'tv'

const tmdbGenreCache = new Map<TmdbKind, Map<number, string>>()

export async function tmdbGenres(apiKey: string, kind: TmdbKind): Promise<Map<number, string>> {
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
export interface TmdbResult {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  genre_ids?: number[]
  overview?: string
  /** 0–10. */
  vote_average?: number
}

export function fromTmdb(kind: TmdbKind, m: TmdbResult, genres: Map<number, string>): ExternalResult {
  return {
    // Prefijo distinto: en TMDB el mismo id numérico puede ser película y serie.
    externalId: `${kind === 'movie' ? 'tmdb' : 'tmdb-tv'}:${m.id}`,
    title: (m.title ?? m.name ?? '').trim(),
    creator: '',
    year: yearOf(m.release_date || m.first_air_date),
    cover: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
    genres: (m.genre_ids ?? []).map((id) => genres.get(id)).filter((g): g is string => Boolean(g)),
  }
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
    .map((m) => fromTmdb(kind, m, genres))

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
          year: yearOf(info.publishedDate),
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

export interface RawgGame {
  id: number
  name: string
  released?: string | null
  background_image?: string | null
  genres?: { name: string }[]
  metacritic?: number | null
  added?: number
}

export function fromRawg(g: RawgGame): ExternalResult {
  return {
    externalId: `rawg:${g.id}`,
    title: g.name,
    creator: '',
    year: yearOf(g.released),
    cover: g.background_image ?? null,
    genres: (g.genres ?? []).map((x) => x.name),
  }
}

async function searchGames(query: string): Promise<ExternalSearchResponse> {
  const apiKey = process.env.RAWG_API_KEY
  if (!apiKey) return { available: false, results: [] }

  const data = (await fetchJson(
    `https://api.rawg.io/api/games?key=${apiKey}&page_size=10&search=${encodeURIComponent(query)}`,
  )) as { results?: RawgGame[] }

  return { available: true, results: (data.results ?? []).map(fromRawg) }
}

// ---- iTunes Search (música) ---------------------------------------------

/** Portada de Apple en otra resolución: sus URLs terminan en "100x100bb.jpg" (u otro tamaño). */
export const appleArtwork = (url: string | undefined | null, size = 600) =>
  url ? url.replace(/\/\d+x\d+(bb)?\.(jpg|png)$/, `/${size}x${size}bb.$2`) : null

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
      year: yearOf(r.releaseDate),
      cover: appleArtwork(r.artworkUrl100),
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
