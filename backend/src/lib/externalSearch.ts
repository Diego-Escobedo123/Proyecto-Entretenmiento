/**
 * Búsqueda contra catálogos externos, uno por tipo de obra. Se usa para
 * autocompletar el formulario de alta y para poblar /discover con datos reales.
 *
 * Proveedores (todos con tier gratuito):
 * - movie: TMDB          (requiere TMDB_API_KEY)
 * - book:  Google Books  (sin key)
 * - game:  RAWG          (requiere RAWG_API_KEY)
 * - music: iTunes Search (sin key)
 *
 * Si falta la key de un proveedor, esa búsqueda vuelve `available: false` en
 * vez de romper: el resto de la app sigue funcionando sin esa fuente.
 */
export type MediaKind = 'movie' | 'book' | 'game' | 'music'

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

// ---- TMDB (películas) -------------------------------------------------

let tmdbGenreCache: Map<number, string> | null = null

async function tmdbGenres(apiKey: string): Promise<Map<number, string>> {
  if (tmdbGenreCache) return tmdbGenreCache
  const data = (await fetchJson(
    `https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}&language=es-ES`,
  )) as { genres?: { id: number; name: string }[] }
  tmdbGenreCache = new Map((data.genres ?? []).map((g) => [g.id, g.name]))
  return tmdbGenreCache
}

async function searchMovies(query: string): Promise<ExternalSearchResponse> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return { available: false, results: [] }

  const [genres, data] = await Promise.all([
    tmdbGenres(apiKey),
    fetchJson(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=es-ES&query=${encodeURIComponent(query)}`,
    ) as Promise<{
      results?: { id: number; title: string; release_date?: string; poster_path?: string | null; genre_ids?: number[] }[]
    }>,
  ])

  const results = (data.results ?? []).slice(0, 10).map((m) => ({
    externalId: `tmdb:${m.id}`,
    title: m.title,
    creator: '',
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    cover: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
    genres: (m.genre_ids ?? []).map((id) => genres.get(id)).filter((g): g is string => Boolean(g)),
  }))

  return { available: true, results }
}

// ---- Google Books (libros) --------------------------------------------

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
          cover: info.imageLinks?.thumbnail?.replace(/^http:/, 'https:') ?? null,
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
      return searchMovies(query)
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
