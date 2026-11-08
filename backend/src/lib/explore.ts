/**
 * Secciones de Explorar, todas con datos reales:
 *
 * - trending   Tendencias de la semana (TMDB, Open Library, RAWG, Apple Music).
 * - upcoming   Estrenos recientes y próximos (TMDB, RAWG, Apple Music).
 * - gems       Joyas escondidas: muy bien calificadas pero poco populares
 *              (TMDB y RAWG; para libros y música no hay fuente confiable).
 *
 * Si RAWG no responde, los juegos salen de Steam (ver steam.ts).
 * - community  Popular en Mosaic: lo que más registran los usuarios de la app.
 * - foryou     Para ti: recomendaciones a partir de la colección del usuario.
 *
 * Cada sección se pide por tipo (o "all", que intercala los tipos). Si una
 * fuente falla o no tiene key, ese tipo simplemente no aporta obras. Las
 * respuestas de catálogos se cachean unas horas; las de la comunidad y "para
 * ti" poco tiempo, porque cambian con lo que registra la gente.
 *
 * Una fuente caída (RAWG y Apple Music lo están a ratos) no debe frenar la
 * pantalla: los catálogos se piden con un timeout corto y, si fallan, ese
 * vacío también se cachea unos minutos para no volver a esperarlo en cada
 * visita. Cada sección espera a todos sus tipos, así que el más lento manda.
 */
import { prisma } from './prisma'
import { fetchJson } from './http'
import {
  appleArtwork,
  findBookEdition,
  fromGoogleBook,
  fromRawg,
  fromTmdb,
  searchExternal,
  tmdbGenres,
  upgradeBookCover,
  type ExternalResult,
  type MediaKind,
  type RawgGame,
  type TmdbKind,
  type TmdbResult,
  withRawgFallback,
} from './externalSearch'
import { fromSteam, steamGems, steamReleaseDay, steamTopGames, type SteamApp } from './steam'

export const SECTIONS = ['trending', 'upcoming', 'gems', 'community', 'foryou'] as const
export type SectionId = (typeof SECTIONS)[number]
export const KINDS: MediaKind[] = ['movie', 'series', 'book', 'game', 'music']

export interface ExploreItem extends ExternalResult {
  type: MediaKind
  /** Línea corta de contexto: "Estreno: 16 sep", "12 personas", "Porque te gustó Dune". */
  note?: string
  /**
   * Calificación 0–5 (un decimal) cuando la sección la muestra: Joyas (TMDB)
   * y Popular en Mosaic. Va aparte del texto para dibujarla con un ícono.
   */
  rating?: number
  /** Sinopsis, para las tarjetas grandes de Joyas escondidas. */
  description?: string
  /** Interno (no se responde): fecha de estreno, para ordenar "Estrenos y próximos". */
  releaseDate?: string
}

const PER_TYPE = 12
const MAX_ALL = 20

const today = () => new Date().toISOString().slice(0, 10)
const daysFrom = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

/** Próximos primero (lo más cercano antes) y después lo ya estrenado (lo más nuevo antes). */
function byRelease(items: ExploreItem[]): ExploreItem[] {
  const now = today()
  const future = items.filter((i) => i.releaseDate && i.releaseDate > now)
  const past = items.filter((i) => !i.releaseDate || i.releaseDate <= now)
  future.sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!))
  past.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
  const seen = new Set<string>()
  return [...future, ...past].filter((i) => !seen.has(i.externalId) && seen.add(i.externalId))
}

/** Página "del día" (1..pages): varía el contenido de Joyas escondidas sin cambiar en cada recarga. */
function pageOfTheDay(pages: number, salt: number): number {
  const day = Math.floor(Date.now() / 86_400_000)
  return ((day + salt) % pages) + 1
}

// ---- Caché en memoria -----------------------------------------------------

const CATALOG_TTL = 3 * 60 * 60 * 1000
const PERSONAL_TTL = 10 * 60 * 1000
/** Cuánto se recuerda que un catálogo vino vacío (caído o sin cuota) antes de reintentar. */
const FAILED_CATALOG_TTL = 10 * 60 * 1000
/** Timeout de los catálogos lentos (RAWG, Apple Music, Open Library). */
const SLOW_SOURCE_TIMEOUT_MS = 5000
const cache = new Map<string, { at: number; items: ExploreItem[] }>()

/**
 * Cachea `load` bajo `key`. Un resultado vacío casi siempre es una fuente
 * caída o sin cuota: sin `emptyTtl` no se guarda (se reintenta en la próxima
 * visita); con `emptyTtl` se guarda ese tiempo, para no volver a esperar el
 * timeout en cada visita mientras la fuente sigue caída.
 */
export async function cached(
  key: string,
  ttl: number,
  load: () => Promise<ExploreItem[]>,
  emptyTtl?: number,
): Promise<ExploreItem[]> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < (hit.items.length ? ttl : (emptyTtl ?? 0))) return hit.items
  const items = await load()
  if (items.length || emptyTtl) cache.set(key, { at: Date.now(), items })
  return items
}

/** Sólo para pruebas: vacía la caché. */
export function clearExploreCache(): void {
  cache.clear()
  editions.clear()
}

// ---- TMDB -------------------------------------------------------------------

/** Talk shows, noticias, reality y telenovelas: ruido para "series de estreno". */
const TMDB_TV_NOISE = '10763,10764,10766,10767'

/** Títulos en escritura asiática: TMDB no los tradujo al español y el usuario no los podría leer. */
const UNTRANSLATED = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/

async function tmdbList(
  kind: TmdbKind,
  path: string,
  note?: (m: TmdbResult) => string | undefined,
  withRating = false,
) {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return []
  const sep = path.includes('?') ? '&' : '?'
  const [genres, data] = await Promise.all([
    tmdbGenres(apiKey, kind),
    fetchJson(`https://api.themoviedb.org/3${path}${sep}api_key=${apiKey}&language=es-MX`) as Promise<{
      results?: TmdbResult[]
    }>,
  ])
  const type: MediaKind = kind === 'movie' ? 'movie' : 'series'
  return (data.results ?? [])
    .filter((m) => (m.title ?? m.name) && m.poster_path && !UNTRANSLATED.test(m.title ?? m.name ?? ''))
    .map((m) => ({
      ...fromTmdb(kind, m, genres),
      type,
      note: note?.(m),
      description: m.overview || undefined,
      releaseDate: m.release_date || m.first_air_date || undefined,
      // TMDB califica de 0 a 10; la app, de 0 a 5.
      rating: withRating && m.vote_average ? Math.round(m.vote_average * 5) / 10 : undefined,
    }))
}

const releaseNote = (date?: string) => {
  if (!date) return undefined
  return date > today() ? `Sale el ${shortDate(date)}` : `Estreno: ${shortDate(date)}`
}

// ---- RAWG -------------------------------------------------------------------

async function rawgList(params: string, note?: (g: RawgGame) => string | undefined) {
  const apiKey = process.env.RAWG_API_KEY
  if (!apiKey) return []
  const data = (await fetchJson(
    `https://api.rawg.io/api/games?key=${apiKey}&page_size=20&${params}`,
    SLOW_SOURCE_TIMEOUT_MS,
  )) as {
    results?: RawgGame[]
  }
  return (data.results ?? [])
    .filter((g) => g.background_image)
    .map((g) => ({
      ...fromRawg(g),
      type: 'game' as const,
      note: note?.(g),
      releaseDate: g.released ?? undefined,
      _added: g.added ?? 0,
    }))
}

// ---- Steam (respaldo de RAWG) -------------------------------------------------

/** Días hacia atrás que cuentan como "acaba de salir" en Estrenos. */
const RECENT_DAYS = 60

function steamItem(app: SteamApp, note?: string): ExploreItem {
  return { ...fromSteam(app), type: 'game', note, releaseDate: steamReleaseDay(app.release_date?.date) }
}

async function steamTrending(): Promise<ExploreItem[]> {
  return (await steamTopGames()).map((app) => steamItem(app))
}

/** Lo que está por salir o salió hace poco, entre lo que más se vende (las listas de novedades de Steam son ruido). */
async function steamUpcoming(): Promise<ExploreItem[]> {
  const items = (await steamTopGames()).map((app) =>
    steamItem(app, releaseNote(steamReleaseDay(app.release_date?.date))),
  )
  return byRelease(items.filter((i) => i.releaseDate && i.releaseDate >= daysFrom(-RECENT_DAYS)))
}

/** Lista curada: cambia cada día cuáles salen primero, como las demás Joyas. */
async function steamGemsOfTheDay(): Promise<ExploreItem[]> {
  const gems = (await steamGems()).map((app) => ({
    ...steamItem(app, app.metacritic ? `Metacritic ${app.metacritic.score}` : undefined),
    description: app.short_description,
  }))
  const start = gems.length ? pageOfTheDay(gems.length, 2) - 1 : 0
  return [...gems.slice(start), ...gems.slice(0, start)]
}

// ---- Apple Music (top de álbumes por país) ----------------------------------

interface AppleAlbum {
  id: string
  name: string
  artistName: string
  releaseDate?: string
  artworkUrl100?: string
  genres?: { name: string }[]
}

/**
 * Tendencias y Estrenos usan el mismo top: se pide una vez por país y se
 * comparte (también entre peticiones simultáneas). El feed a veces tarda,
 * así que tiene más margen que el resto; si falla, no se guarda.
 */
const appleTop = new Map<string, { at: number; albums: Promise<AppleAlbum[]> }>()

function appleTopFeed(region: string): Promise<AppleAlbum[]> {
  const hit = appleTop.get(region)
  if (hit && Date.now() - hit.at < CATALOG_TTL) return hit.albums
  const albums = (
    fetchJson(
      `https://rss.marketingtools.apple.com/api/v2/${region.toLowerCase()}/music/most-played/50/albums.json`,
      SLOW_SOURCE_TIMEOUT_MS,
    ) as Promise<{ feed?: { results?: AppleAlbum[] } }>
  ).then((data) => data.feed?.results ?? [])
  albums.catch(() => appleTop.delete(region))
  appleTop.set(region, { at: Date.now(), albums })
  return albums
}

async function appleTopAlbums(region: string): Promise<ExploreItem[]> {
  return (await appleTopFeed(region)).map((a) => ({
    type: 'music' as const,
    externalId: `itunes:${a.id}`,
    title: a.name,
    creator: a.artistName,
    year: a.releaseDate ? Number(a.releaseDate.slice(0, 4)) : null,
    cover: appleArtwork(a.artworkUrl100),
    genres: (a.genres ?? []).map((g) => g.name).filter((g) => g !== 'Música'),
    releaseDate: a.releaseDate,
  }))
}

// ---- Open Library (tendencias de libros) ------------------------------------

async function openLibraryTrending(): Promise<ExploreItem[]> {
  const data = (await fetchJson('https://openlibrary.org/trending/weekly.json?limit=30', SLOW_SOURCE_TIMEOUT_MS)) as {
    works?: { key: string; title: string; author_name?: string[]; first_publish_year?: number; cover_i?: number }[]
  }
  return (data.works ?? [])
    .filter((w) => w.cover_i)
    .map((w) => ({
      type: 'book' as const,
      externalId: `openlibrary:${w.key.replace('/works/', '')}`,
      title: w.title,
      creator: w.author_name?.join(', ') ?? '',
      year: w.first_publish_year ?? null,
      cover: `https://covers.openlibrary.org/b/id/${w.cover_i}-L.jpg`,
      genres: [],
    }))
}

// ---- Tendencias de libros en español ------------------------------------------

/** Cuántos libros se buscan a la vez, y hasta cuándo: la fila no debe quedar esperando. */
const EDITION_BATCH = 6
const EDITION_BUDGET_MS = 5000
const EDITION_TIMEOUT_MS = 2500
const EDITION_TTL = 24 * 60 * 60 * 1000

/** Por libro, incluso cuando no hay edición en español: así no se gasta cuota de Google Books. */
const editions = new Map<string, { at: number; item: ExploreItem | null }>()

async function spanishEdition(book: ExploreItem): Promise<ExploreItem> {
  const hit = editions.get(book.externalId)
  if (hit && Date.now() - hit.at < EDITION_TTL) return hit.item ?? book
  try {
    const author = book.creator.split(',')[0]
    const edition = await findBookEdition(book.title, author, { language: 'es', timeoutMs: EDITION_TIMEOUT_MS })
    const item = edition ? { ...fromGoogleBook(edition), type: 'book' as const } : null
    editions.set(book.externalId, { at: Date.now(), item })
    return item ?? book
  } catch {
    return book // Google Books falló: sin guardar, para reintentar.
  }
}

/**
 * Open Library sólo tiene la lista global, casi toda en inglés: cada libro se
 * cambia por su edición en español si existe; si no, queda como está.
 */
async function trendingBooks(): Promise<ExploreItem[]> {
  const books = await openLibraryTrending()
  const start = Date.now()
  const out: ExploreItem[] = []
  for (let i = 0; i < books.length; i += EDITION_BATCH) {
    const batch = books.slice(i, i + EDITION_BATCH)
    out.push(...(Date.now() - start < EDITION_BUDGET_MS ? await Promise.all(batch.map(spanishEdition)) : batch))
  }
  const seen = new Set<string>()
  return out.filter((b) => !seen.has(b.externalId) && seen.add(b.externalId))
}

// ---- Secciones de catálogo (iguales para todos) -----------------------------

type Provider = (region: string) => Promise<ExploreItem[]>

const CATALOG: Record<'trending' | 'upcoming' | 'gems', Partial<Record<MediaKind, Provider>>> = {
  trending: {
    movie: () => tmdbList('movie', '/trending/movie/week'),
    series: () => tmdbList('tv', '/trending/tv/week'),
    book: () => trendingBooks(),
    game: () =>
      withRawgFallback<ExploreItem[]>(
        () =>
          rawgList(`dates=${daysFrom(-60)},${today()}&ordering=-added`, (g) =>
            g.released ? `Salió el ${shortDate(g.released)}` : undefined,
          ),
        steamTrending,
      ),
    music: (region) => appleTopAlbums(region),
  },
  upcoming: {
    // Todas pasan por byRelease: próximos (lo más cercano antes) y luego lo recién estrenado.
    movie: async (region) => {
      const [soon, now] = await Promise.all([
        tmdbList('movie', `/movie/upcoming?region=${region}`, (m) => releaseNote(m.release_date)),
        tmdbList('movie', `/movie/now_playing?region=${region}`, (m) => releaseNote(m.release_date)),
      ])
      return byRelease([...soon, ...now])
    },
    series: async () =>
      byRelease(
        await tmdbList(
          'tv',
          `/discover/tv?sort_by=popularity.desc&first_air_date.gte=${daysFrom(-45)}&first_air_date.lte=${daysFrom(60)}&without_genres=${TMDB_TV_NOISE}&vote_count.gte=5`,
          (m) => releaseNote(m.first_air_date),
        ),
      ),
    game: () =>
      withRawgFallback<ExploreItem[]>(async () => {
        const [soon, recent] = await Promise.all([
          rawgList(`dates=${today()},${daysFrom(120)}&ordering=-added`, (g) => releaseNote(g.released ?? undefined)),
          rawgList(`dates=${daysFrom(-30)},${today()}&ordering=-added`, (g) => releaseNote(g.released ?? undefined)),
        ])
        return byRelease([...soon, ...recent])
      }, steamUpcoming),
    // Apple no tiene feed de estrenos: los álbumes del top salidos en el último mes.
    music: async (region) =>
      byRelease(
        (await appleTopAlbums(region))
          .filter((a) => a.releaseDate && a.releaseDate >= daysFrom(-35))
          .map((a) => ({ ...a, note: releaseNote(a.releaseDate) })),
      ),
  },
  gems: {
    movie: () =>
      tmdbList(
        'movie',
        `/discover/movie?sort_by=vote_average.desc&vote_average.gte=7.5&vote_count.gte=300&vote_count.lte=2500&without_genres=16,99,10402&page=${pageOfTheDay(5, 0)}`,
        undefined,
        true,
      ),
    series: () =>
      tmdbList(
        'tv',
        `/discover/tv?sort_by=vote_average.desc&vote_average.gte=7.8&vote_count.gte=150&vote_count.lte=1500&without_genres=16,${TMDB_TV_NOISE}&page=${pageOfTheDay(4, 1)}`,
        undefined,
        true,
      ),
    // Metacritic alto pero pocos jugadores en RAWG: ni clásicos archiconocidos ni ediciones duplicadas.
    game: () =>
      withRawgFallback<ExploreItem[]>(
        async () =>
          (await rawgList(`metacritic=85,100&ordering=-metacritic&page=${pageOfTheDay(5, 2)}`, (g) =>
            g.metacritic ? `Metacritic ${g.metacritic}` : undefined,
          )).filter((g) => g._added >= 30 && g._added <= 2500),
        steamGemsOfTheDay,
      ),
  },
}

// ---- Popular en Mosaic --------------------------------------------------

async function community(type: MediaKind | 'all'): Promise<ExploreItem[]> {
  const groups = await prisma.mediaEntry.groupBy({
    by: ['type', 'externalId'],
    where: { externalId: { not: null }, ...(type !== 'all' && { type }) },
    _count: { _all: true },
    _avg: { rating: true },
    orderBy: [{ _count: { externalId: 'desc' } }, { _avg: { rating: 'desc' } }],
    take: MAX_ALL,
  })
  if (!groups.length) return []

  // Los datos de la obra (portada, título…) salen de uno de los registros.
  const samples = await prisma.mediaEntry.findMany({
    where: { OR: groups.map((g) => ({ type: g.type, externalId: g.externalId })) },
    distinct: ['type', 'externalId'],
    select: { type: true, externalId: true, title: true, creator: true, year: true, cover: true, genres: true },
  })
  const byKey = new Map(samples.map((s) => [`${s.type}|${s.externalId}`, s]))

  return groups.flatMap((g) => {
    const s = byKey.get(`${g.type}|${g.externalId}`)
    if (!s) return []
    const people = g._count._all
    const avg = g._avg.rating
    return [
      {
        type: s.type as MediaKind,
        externalId: s.externalId!,
        title: s.title,
        creator: s.creator,
        year: s.year,
        cover: upgradeBookCover(s.cover),
        genres: s.genres,
        note: `${people} ${people === 1 ? 'persona' : 'personas'}`,
        rating: avg != null ? Math.round(avg * 10) / 10 : undefined,
      },
    ]
  })
}

// ---- Para ti --------------------------------------------------------------

let rawgGenreSlugs: Map<string, string> | null = null

async function rawgSlugFor(name: string): Promise<string | null> {
  const apiKey = process.env.RAWG_API_KEY
  if (!apiKey) return null
  if (!rawgGenreSlugs) {
    const data = (await fetchJson(`https://api.rawg.io/api/genres?key=${apiKey}`)) as {
      results?: { name: string; slug: string }[]
    }
    rawgGenreSlugs = new Map((data.results ?? []).map((g) => [g.name.toLowerCase(), g.slug]))
  }
  return rawgGenreSlugs.get(name.toLowerCase()) ?? null
}

function topGenre(entries: { genres: string[] }[]): string | null {
  const tally = new Map<string, number>()
  for (const e of entries) for (const g of e.genres) tally.set(g, (tally.get(g) ?? 0) + 1)
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

async function forYou(userId: string, type: MediaKind): Promise<ExploreItem[]> {
  const entries = await prisma.mediaEntry.findMany({
    where: { userId, type },
    select: { title: true, creator: true, externalId: true, rating: true, favorite: true, genres: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (!entries.length) return []

  // Semillas: favoritas y mejor calificadas primero.
  const seeds = [...entries]
    .filter((e) => e.favorite || (e.rating ?? 0) >= 4)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 3)

  let items: ExploreItem[] = []

  if (type === 'movie' || type === 'series') {
    const kind: TmdbKind = type === 'movie' ? 'movie' : 'tv'
    const prefix = kind === 'movie' ? 'tmdb:' : 'tmdb-tv:'
    const lists = await Promise.all(
      seeds
        .filter((s) => s.externalId?.startsWith(prefix))
        .map((s) =>
          tmdbList(kind, `/${kind}/${s.externalId!.slice(prefix.length)}/recommendations`, () => `Porque te gustó ${s.title}`).catch(
            () => [],
          ),
        ),
    )
    items = interleave(lists)
  } else if (type === 'game') {
    const genre = topGenre(entries)
    // Sin RAWG no hay recomendación por género: la fila no aparece (y no espera su timeout).
    items = await withRawgFallback<ExploreItem[]>(async () => {
      const slug = genre ? await rawgSlugFor(genre) : null
      return slug ? rawgList(`genres=${slug}&ordering=-rating&metacritic=75,100`, () => `Por tu gusto por ${genre}`) : []
    }, async () => [])
  } else if (type === 'book') {
    const genre = topGenre(entries)
    if (genre) {
      const res = await searchExternal('book', `subject:"${genre}"`)
      // Una búsqueda por género trae de todo: sin portada ni autor suelen ser tesis o folletos.
      items = res.results
        .filter((r) => r.cover && r.creator)
        .map((r) => ({ ...r, type: 'book' as const, note: `Por tu gusto por ${genre}` }))
    }
  } else if (type === 'music') {
    // Más de los artistas que mejor calificaste.
    const artists = [...new Set(seeds.map((s) => s.creator).filter(Boolean))].slice(0, 2)
    const lists = await Promise.all(
      artists.map(async (artist) => {
        const res = await searchExternal('music', artist)
        return res.results
          .filter((r) => r.creator.toLowerCase() === artist.toLowerCase())
          .map((r) => ({ ...r, type: 'music' as const, note: `Más de ${artist}` }))
      }),
    )
    items = interleave(lists)
  }

  // Nada de lo que ya tiene en su colección.
  const owned = new Set(entries.map((e) => e.externalId).filter(Boolean))
  const ownedTitles = new Set(entries.map((e) => e.title.toLowerCase()))
  return items.filter((i) => !owned.has(i.externalId) && !ownedTitles.has(i.title.toLowerCase()))
}

// ---- Armado -------------------------------------------------------------

/** Intercala varias listas (una obra de cada una por turno) y quita repetidas. */
function interleave(lists: ExploreItem[][]): ExploreItem[] {
  const out: ExploreItem[] = []
  const seen = new Set<string>()
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const list of lists) {
      const item = list[i]
      if (item && !seen.has(item.externalId)) {
        seen.add(item.externalId)
        out.push(item)
      }
    }
  }
  return out
}

/** Quita campos internos (p. ej. `_added` de RAWG) antes de responder. */
function clean(items: ExploreItem[]): ExploreItem[] {
  return items.map(({ type, externalId, title, creator, year, cover, genres, note, description, rating }) => ({
    type,
    externalId,
    title,
    creator,
    year,
    cover,
    genres,
    ...(note && { note }),
    ...(rating != null && { rating }),
    ...(description && { description }),
  }))
}

async function safely(label: string, load: () => Promise<ExploreItem[]>): Promise<ExploreItem[]> {
  try {
    return await load()
  } catch (err) {
    console.error(`explore/${label}:`, err)
    return []
  }
}

export async function getSection(
  section: SectionId,
  type: MediaKind | 'all',
  options: { region: string; userId: string },
): Promise<ExploreItem[]> {
  const { region, userId } = options

  if (section === 'community') {
    return cached(`community|${type}`, PERSONAL_TTL, () => safely('community', () => community(type)))
  }

  const kinds = type === 'all' ? KINDS : [type]
  const perKind = await Promise.all(
    kinds.map((kind) => {
      if (section === 'foryou') {
        return cached(`foryou|${userId}|${kind}`, PERSONAL_TTL, () => safely(`foryou/${kind}`, () => forYou(userId, kind)))
      }
      const provider = CATALOG[section][kind]
      if (!provider) return Promise.resolve([])
      return cached(
        `${section}|${kind}|${region}`,
        CATALOG_TTL,
        () => safely(`${section}/${kind}`, () => provider(region)),
        FAILED_CATALOG_TTL,
      )
    }),
  )

  const lists = perKind.map((list) => clean(list).slice(0, type === 'all' ? PER_TYPE : 30))
  return type === 'all' ? interleave(lists).slice(0, MAX_ALL) : lists[0]
}
