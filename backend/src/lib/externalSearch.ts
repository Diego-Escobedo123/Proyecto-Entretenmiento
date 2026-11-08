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
 * - game:  RAWG          (requiere RAWG_API_KEY); si no responde, Steam (steam.ts)
 * - music: iTunes Search (sin key)
 *
 * Si falta la key de un proveedor, esa búsqueda vuelve `available: false` en
 * vez de romper: el resto de la app sigue funcionando sin esa fuente.
 */
import { fetchJson } from './http'
import { searchSteam } from './steam'

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
    `https://api.themoviedb.org/3/genre/${kind}/list?api_key=${apiKey}&language=es-MX`,
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
      `https://api.themoviedb.org/3/search/${kind}?api_key=${apiKey}&language=es-MX&query=${encodeURIComponent(query)}`,
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

export interface GoogleBook {
  id: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publishedDate?: string
    imageLinks?: { thumbnail?: string }
    categories?: string[]
    language?: string
    description?: string
  }
}

/** Una consulta a Google Books. No filtra por idioma: su `langRestrict` no cambia los resultados. */
async function fetchGoogleBooks(query: string, timeoutMs?: number): Promise<GoogleBook[]> {
  // Sin key, la cuota compartida de Google Books rate-limita rápido (429).
  // Con GOOGLE_BOOKS_API_KEY (opcional, gratis) la cuota es individual.
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  const keyParam = apiKey ? `&key=${apiKey}` : ''
  const data = (await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?maxResults=20&q=${encodeURIComponent(query)}${keyParam}`,
    timeoutMs,
  )) as { items?: GoogleBook[] }
  return (data.items ?? []).filter((item) => item.volumeInfo?.title)
}

export function fromGoogleBook(item: GoogleBook): ExternalResult {
  const info = item.volumeInfo!
  return {
    externalId: `googlebooks:${item.id}`,
    title: info.title!,
    creator: info.authors?.join(', ') ?? '',
    year: yearOf(info.publishedDate),
    cover: upgradeBookCover(info.imageLinks?.thumbnail ?? null),
    genres: info.categories ?? [],
  }
}

/** "es-419" -> "es". */
const bookLanguage = (item: GoogleBook) => (item.volumeInfo?.language ?? '').split('-')[0].toLowerCase()

/**
 * Español primero, después inglés y al final los demás idiomas; nada se
 * esconde. Dentro de eso, los que tienen portada: sin ella suelen ser resúmenes
 * de terceros ("Resumen de Hábitos Atómicos"), que no deben tapar al libro real.
 */
function bookRank(item: GoogleBook): number {
  const language = bookLanguage(item)
  const hasCover = !!item.volumeInfo?.imageLinks
  if (language === 'es' || language === 'en') return (hasCover ? 0 : 2) + (language === 'es' ? 0 : 1)
  return hasCover ? 4 : 5
}

export const rankBooksByLanguage = (items: GoogleBook[]) => [...items].sort((a, b) => bookRank(a) - bookRank(b))

const SPANISH_WORDS = new Set(
  'el la los las de del que y en un una por con para es su sus al lo como más pero este esta se le'.split(' '),
)
const ENGLISH_WORDS = new Set(
  'the of and to in is that with for his her it as was on by an are from this he she they'.split(' '),
)
/** Con menos palabras no se puede saber; con menos proporción, es otro idioma. */
const MIN_WORDS = 8
const MIN_RATIO = 0.15

/**
 * Idioma de un texto, contando palabras comunes: el `language` de Google Books
 * no alcanza (un libro marcado "en" puede traer la sinopsis en eslovaco).
 */
export function detectLanguage(text: string): 'es' | 'en' | null {
  const words = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean)
  if (words.length < MIN_WORDS) return null
  const es = words.filter((w) => SPANISH_WORDS.has(w)).length / words.length
  const en = words.filter((w) => ENGLISH_WORDS.has(w)).length / words.length
  if (es >= MIN_RATIO && es > en) return 'es'
  if (en >= MIN_RATIO && en > es) return 'en'
  return null
}

/** Artículos y similares: no sirven para decir que dos títulos son el mismo libro. */
const TITLE_NOISE = new Set(
  'the a an of and to in is for on with how your you my i el la los las de del y un una en tu su por para con que como'.split(' '),
)
const titleWords = (s: string) => normalizeName(s).split(' ').filter((w) => w && !TITLE_NOISE.has(w))

/** Largo mínimo para tratar dos palabras como la misma entre idiomas ("seduction"/"seduccion", "habits"/"habitos"). */
const COGNATE_PREFIX = 4

function sameOrCognate(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < COGNATE_PREFIX || b.length < COGNATE_PREFIX) return false
  return a.slice(0, COGNATE_PREFIX) === b.slice(0, COGNATE_PREFIX)
}

interface EditionOptions {
  language: 'es' | 'en'
  /**
   * Sólo si tiene todas las palabras del título original y una sinopsis en ese
   * idioma. Para mostrar su sinopsis bajo el título original, donde otro libro
   * del mismo autor sería un error. Sin esto basta el mismo autor, portada y una
   * palabra en común con el título o el subtítulo: sirve para cambiar el libro
   * completo (título, portada y ficha). Sin esa palabra podría salir otro libro
   * del autor: "The Mountain Is You" no es "Eres la protagonista de tu vida".
   */
  strict?: boolean
  timeoutMs?: number
}

/** Otra edición del mismo libro en `language`, o null. Lanza si Google Books falla. */
export async function findBookEdition(title: string, author: string, options: EditionOptions): Promise<GoogleBook | null> {
  const { language, strict, timeoutMs } = options
  const authorWords = normalizeName(author).split(' ').filter(Boolean)
  const lastName = authorWords[authorWords.length - 1]
  const original = titleWords(title)
  const fullTitle = (b: GoogleBook) => titleWords(`${b.volumeInfo?.title ?? ''} ${b.volumeInfo?.subtitle ?? ''}`)

  const candidates = (await fetchGoogleBooks(`${title} ${author}`.trim(), timeoutMs)).filter((b) => {
    if (bookLanguage(b) !== language) return false
    if (lastName && !normalizeName((b.volumeInfo?.authors ?? []).join(' ')).split(' ').includes(lastName)) return false
    return true
  })
  if (!strict) {
    return (
      candidates.find(
        (b) => b.volumeInfo?.imageLinks && original.some((w) => fullTitle(b).some((other) => sameOrCognate(w, other))),
      ) ?? null
    )
  }

  // El de título más parecido: "Sapiens. De animales a dioses" antes que "Sapiens. Una historia gráfica 1".
  return (
    candidates
      .filter((b) => original.every((w) => fullTitle(b).includes(w)))
      .filter((b) => detectLanguage(b.volumeInfo?.description ?? '') === language)
      .sort((a, b) => fullTitle(a).length - fullTitle(b).length)[0] ?? null
  )
}

async function searchBooks(query: string): Promise<ExternalSearchResponse> {
  try {
    const items = await fetchGoogleBooks(query)
    return { available: true, results: rankBooksByLanguage(items).map(fromGoogleBook) }
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

/** Nombre comparable: sin mayúsculas, acentos ni signos ("Pokémon: Rojo" -> "pokemon rojo"). */
export const normalizeName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Todas las palabras buscadas aparecen en el nombre (como palabra o su inicio: "zel" -> "Zelda"). */
function hasAllWords(name: string, queryWords: string[]): boolean {
  const words = normalizeName(name).split(' ')
  return queryWords.every((q) => words.some((w) => w.startsWith(q)))
}

/** Tras un fallo de RAWG, cuánto se va directo al respaldo sin volver a esperarlo. */
const RAWG_RETRY_MS = 10 * 60 * 1000
let rawgDownUntil = 0

/**
 * Usa RAWG y, si falla o no hay key, el respaldo (Steam). RAWG caído tarda
 * hasta el timeout en fallar: después de un fallo no se le vuelve a preguntar
 * durante unos minutos, así las siguientes búsquedas no esperan.
 */
export async function withRawgFallback<T>(rawg: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (!process.env.RAWG_API_KEY || Date.now() < rawgDownUntil) return fallback()
  try {
    return await rawg()
  } catch (err) {
    console.error('RAWG no responde, se usa el respaldo:', err)
    rawgDownUntil = Date.now() + RAWG_RETRY_MS
    return fallback()
  }
}

/** Sólo para pruebas: olvida que RAWG estaba caído. */
export function resetRawgStatus(): void {
  rawgDownUntil = 0
}

function searchGames(query: string): Promise<ExternalSearchResponse> {
  return withRawgFallback(
    () => searchRawg(query),
    async () => {
      // Steam también trae juegos que sólo se parecen: mismo filtro de palabras que con RAWG.
      const results = await searchSteam(query)
      const queryWords = normalizeName(query).split(' ').filter(Boolean)
      const matching = results.filter((r) => hasAllWords(r.title, queryWords))
      return { available: true, results: matching.length ? matching : results }
    },
  )
}

async function searchRawg(query: string): Promise<ExternalSearchResponse> {
  const apiKey = process.env.RAWG_API_KEY

  // El orden por defecto de RAWG es por parecido del nombre: los juegos de
  // fans ("ZELDA (Raul Fernandes)") tapan a los oficiales. Ordenado por
  // popularidad, en cambio, con varias palabras se cuela cualquier juego
  // famoso que tenga una ("tears of the kingdom" -> The Witcher). Se piden
  // las dos listas a la vez y se rearman: sólo los que tienen todas las
  // palabras buscadas, de más a menos popular. Si ninguno las tiene (p. ej.
  // un error de tipeo, "zeldaa"), todo lo que devolvió RAWG.
  const url = (params: string) =>
    `https://api.rawg.io/api/games?key=${apiKey}&page_size=20&search=${encodeURIComponent(query)}${params}`
  const [byName, byPopularity] = await Promise.all(
    [url(''), url('&search_precise=true&ordering=-added')].map(
      (u) => fetchJson(u).then((d) => (d as { results?: RawgGame[] }).results ?? []),
    ),
  )

  const unique = [...new Map([...byName, ...byPopularity].map((g) => [g.id, g])).values()]
  const queryWords = normalizeName(query).split(' ').filter(Boolean)
  const matching = unique.filter((g) => hasAllWords(g.name, queryWords))
  const results = (matching.length ? matching : unique)
    .sort((a, b) => (b.added ?? 0) - (a.added ?? 0))
    .slice(0, 10)
    .map(fromRawg)

  return { available: true, results }
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
