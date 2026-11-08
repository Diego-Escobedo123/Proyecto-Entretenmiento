/**
 * Ficha extendida de una obra del catálogo externo (sinopsis, reparto,
 * canciones, dónde verla/leerla/jugarla/escucharla…). No se guarda en la
 * base: es dato del catálogo, no del usuario, y cambia con el tiempo (las
 * plataformas rotan cada mes). Se pide a la API al abrir la ficha y se
 * cachea en memoria unas horas.
 *
 * Fuentes, según el prefijo del `externalId`:
 * - tmdb / tmdb-tv  TMDB          (películas / series)
 * - googlebooks     Google Books  (libros)
 * - openlibrary     Open Library  (libros que vienen de Explorar → Tendencias)
 * - rawg            RAWG          (juegos)
 * - steam           Steam         (juegos, cuando RAWG no responde; en español)
 * - itunes          iTunes        (álbumes)
 */
import { detectLanguage, findBookEdition } from './externalSearch'
import { fetchJson } from './http'
import { steamApp } from './steam'

export interface CastMember {
  name: string
  character: string
  photo: string | null
}

/** Un lugar donde consumir la obra, con enlace directo o a su buscador. */
export interface WorkLink {
  name: string
  logo: string | null
  url: string
  /**
   * Código ISO del único país donde aplica (p. ej. "GT" para Sophos). El
   * frontend lo muestra sólo si el usuario está ahí; así la respuesta (y la
   * caché) es la misma para todos.
   */
  onlyIn?: string
}

export interface Track {
  name: string
  /** Segundos. */
  duration: number | null
}

export interface WorkDetails {
  overview: string
  /** Datos cortos ya formateados: "5 temporadas", "320 páginas"… */
  facts: string[]
  /** Dirección, Creación, Editorial, Desarrollo… */
  people: { label: string; names: string[] }[]
  cast: CastMember[]
  tracks: Track[]
  /** Datos crudos para el seguimiento en el formulario (páginas, episodios, plataformas). */
  pages: number | null
  /** Sólo series: episodios de cada temporada regular (sin especiales). */
  seasons: { number: number; episodes: number }[]
  platforms: string[]
  /** Dónde consumirla. `region` sólo cuando la disponibilidad depende del país. */
  where: {
    region: string | null
    groups: { label: string; items: WorkLink[] }[]
    /** Atribución que exige la fuente de los datos. */
    credit: string | null
  } | null
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const MAX_CAST = 8

const cache = new Map<string, { at: number; value: WorkDetails | null }>()

const q = encodeURIComponent

/** Ícono del sitio, para plataformas que no traen logo propio. */
const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// ---- TMDB (películas y series) ---------------------------------------

/**
 * TMDB no da el enlace a la obra dentro de cada plataforma, sólo el nombre.
 * Se abre el buscador de la plataforma con el título; si no se conoce (o no
 * admite búsqueda por URL, como Disney+), una búsqueda web del título en ella.
 */
const PLATFORM_SEARCH: [RegExp, (title: string) => string][] = [
  [/^netflix/i, (t) => `https://www.netflix.com/search?q=${q(t)}`],
  [/prime video|amazon video/i, (t) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q(t)}`],
  [/^apple tv/i, (t) => `https://tv.apple.com/search?term=${q(t)}`],
  [/hbo max|^max$/i, (t) => `https://play.hbomax.com/search?q=${q(t)}`],
  [/paramount/i, (t) => `https://www.paramountplus.com/search/?query=${q(t)}`],
  [/crunchyroll/i, (t) => `https://www.crunchyroll.com/search?q=${q(t)}`],
  [/mubi/i, (t) => `https://mubi.com/search/films?query=${q(t)}`],
  [/youtube/i, (t) => `https://www.youtube.com/results?search_query=${q(t)}`],
  [/google play/i, (t) => `https://play.google.com/store/search?q=${q(t)}&c=movies`],
  [/^vix/i, (t) => `https://vix.com/es/buscar?q=${q(t)}`],
  [/movistar plus/i, (t) => `https://ver.movistarplus.es/busqueda/?q=${q(t)}`],
  [/tubi/i, (t) => `https://tubitv.com/search/${q(t)}`],
  [/pluto/i, (t) => `https://pluto.tv/search?query=${q(t)}`],
  [/hulu/i, (t) => `https://www.hulu.com/search?q=${q(t)}`],
  [/peacock/i, (t) => `https://www.peacocktv.com/search?q=${q(t)}`],
  [/atres/i, (t) => `https://www.atresplayer.com/buscador/?q=${q(t)}`],
  [/rtve/i, (t) => `https://www.rtve.es/play/buscador/?q=${q(t)}`],
]

function platformUrl(provider: string, title: string): string {
  const match = PLATFORM_SEARCH.find(([re]) => re.test(provider))
  return match ? match[1](title) : `https://www.google.com/search?q=${q(`${title} ${provider}`)}`
}

const tmdbImage = (path: string | null | undefined, size: string) =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null

interface TmdbProviderEntry {
  provider_name: string
  logo_path?: string | null
}

interface TmdbDetails {
  title?: string
  name?: string
  overview?: string
  runtime?: number | null
  episode_run_time?: number[]
  last_episode_to_air?: { runtime?: number | null } | null
  number_of_seasons?: number
  number_of_episodes?: number
  seasons?: { season_number: number; episode_count: number }[]
  created_by?: { name: string }[]
  credits?: {
    cast?: { name: string; character?: string; profile_path?: string | null }[]
    crew?: { name: string; job?: string }[]
  }
  'watch/providers'?: {
    results?: Record<string, { flatrate?: TmdbProviderEntry[]; rent?: TmdbProviderEntry[]; buy?: TmdbProviderEntry[] }>
  }
}

async function tmdbDetails(kind: 'movie' | 'tv', id: string, region: string): Promise<WorkDetails | null> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return null

  const base = `https://api.themoviedb.org/3/${kind}/${q(id)}?api_key=${apiKey}`
  const data = (await fetchJson(`${base}&language=es-MX&append_to_response=credits,watch/providers`)) as TmdbDetails
  const title = data.title ?? data.name ?? ''

  // Muchas obras no tienen sinopsis traducida: se usa la original en inglés.
  let overview = data.overview?.trim() ?? ''
  if (!overview) {
    const en = (await fetchJson(`${base}&language=en-US`).catch(() => ({}))) as TmdbDetails
    overview = en.overview?.trim() ?? ''
  }

  const facts: string[] = []
  if (data.number_of_seasons) facts.push(plural(data.number_of_seasons, 'temporada', 'temporadas'))
  if (data.number_of_episodes) facts.push(plural(data.number_of_episodes, 'episodio', 'episodios'))
  const runtime = data.runtime || data.episode_run_time?.[0] || data.last_episode_to_air?.runtime
  if (runtime) facts.push(kind === 'tv' ? `${formatMinutes(runtime)} por episodio` : formatMinutes(runtime))

  const creators =
    kind === 'tv'
      ? (data.created_by ?? []).map((p) => p.name)
      : (data.credits?.crew ?? []).filter((p) => p.job === 'Director').map((p) => p.name)

  // TMDB lista variantes de la misma plataforma ("… with Ads", "… Amazon Channel"): se omiten.
  const toLinks = (list?: TmdbProviderEntry[]) =>
    (list ?? [])
      .filter((p) => !/with ads$|channel$/i.test(p.provider_name.trim()))
      .map((p) => {
        const name = p.provider_name.trim()
        return { name, logo: tmdbImage(p.logo_path, 'w92'), url: platformUrl(name, title) }
      })
  const byRegion = data['watch/providers']?.results?.[region]

  return {
    overview,
    facts,
    people: creators.length ? [{ label: kind === 'tv' ? 'Creación' : 'Dirección', names: [...new Set(creators)] }] : [],
    cast: (data.credits?.cast ?? []).slice(0, MAX_CAST).map((p) => ({
      name: p.name,
      character: p.character ?? '',
      photo: tmdbImage(p.profile_path, 'w185'),
    })),
    tracks: [],
    pages: null,
    seasons: (data.seasons ?? [])
      .filter((s) => s.season_number > 0 && s.episode_count > 0)
      .map((s) => ({ number: s.season_number, episodes: s.episode_count })),
    platforms: [],
    where: {
      region,
      groups: [
        { label: 'Streaming', items: toLinks(byRegion?.flatrate) },
        { label: 'Renta', items: toLinks(byRegion?.rent) },
        { label: 'Compra', items: toLinks(byRegion?.buy) },
      ].filter((g) => g.items.length),
      credit: 'Datos de plataformas: JustWatch',
    },
  }
}

// ---- Google Books (libros) --------------------------------------------

/** Tienda de Amazon del país; si no hay una propia, la de EE. UU. */
const AMAZON_DOMAIN: Record<string, string> = {
  MX: 'amazon.com.mx',
  ES: 'amazon.es',
  BR: 'amazon.com.br',
  GB: 'amazon.co.uk',
  CA: 'amazon.ca',
  DE: 'amazon.de',
  FR: 'amazon.fr',
  IT: 'amazon.it',
}

/**
 * Librería Sophos (Guatemala), aliado propuesto para el modelo de comisiones:
 * abre su buscador con el título y el autor. Los campos `tipoBus` y
 * `aproximada` los manda su propio formulario; sin ellos no encuentra nada.
 * `ref=mosaic` marca que la visita vino de Mosaic (hoy no hay acuerdo, así que
 * Sophos lo ignora). Por título + autor y no por ISBN: por ISBN sólo encuentra
 * esa edición exacta.
 */
export function sophosLink(title: string, author?: string): WorkLink {
  const terms = [title, author].filter(Boolean).join(' ')
  return {
    name: 'Sophos',
    logo: favicon('sophosenlinea.com'),
    url: `https://tienda.sophosenlinea.com/busqueda/listaLibros.php?tipoBus=full&aproximada=N&palabrasBusqueda=${q(terms)}&ref=mosaic`,
    onlyIn: 'GT',
  }
}

/** Google Books manda la descripción en HTML simple. */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * La sinopsis es la de la edición que eligió el usuario, que puede estar en
 * cualquier idioma: si no está en español se busca la de una edición en español
 * del mismo libro; si tampoco está en inglés, la de una en inglés. Si no hay o
 * Google Books falla, queda la que había.
 */
async function readableOverview(current: string, title: string | undefined, author: string): Promise<string> {
  const language = detectLanguage(current)
  if (!title || language === 'es') return current
  try {
    const spanish = await findBookEdition(title, author, { language: 'es', strict: true })
    const edition = spanish ?? (language === 'en' ? null : await findBookEdition(title, author, { language: 'en', strict: true }))
    return edition?.volumeInfo?.description ? htmlToText(edition.volumeInfo.description) : current
  } catch {
    return current
  }
}

async function bookDetails(id: string, region: string): Promise<WorkDetails> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  const data = (await fetchJson(
    `https://www.googleapis.com/books/v1/volumes/${q(id)}${apiKey ? `?key=${apiKey}` : ''}`,
  )) as {
    volumeInfo?: {
      title?: string
      authors?: string[]
      publisher?: string
      description?: string
      pageCount?: number
      language?: string
      infoLink?: string
      industryIdentifiers?: { type: string; identifier: string }[]
    }
    saleInfo?: { buyLink?: string }
  }
  const info = data.volumeInfo ?? {}

  const ownOverview = info.description ? htmlToText(info.description) : ''
  const overview = await readableOverview(ownOverview, info.title, info.authors?.[0] ?? '')

  const facts: string[] = []
  if (info.pageCount) facts.push(plural(info.pageCount, 'página', 'páginas'))
  // Si la sinopsis es de otra edición, "En inglés" junto a un texto en español confundiría.
  if (info.language && overview === ownOverview) {
    try {
      const lang = new Intl.DisplayNames(['es'], { type: 'language' }).of(info.language)
      if (lang) facts.push(`En ${lang.toLowerCase()}`)
    } catch {
      /* código de idioma no reconocido */
    }
  }

  const isbn =
    info.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier ??
    info.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier
  const searchTerm = isbn ?? [info.title, info.authors?.[0]].filter(Boolean).join(' ')
  const amazon = AMAZON_DOMAIN[region] ?? 'amazon.com'

  return {
    overview,
    facts,
    people: info.publisher ? [{ label: 'Editorial', names: [info.publisher] }] : [],
    cast: [],
    tracks: [],
    pages: info.pageCount ?? null,
    seasons: [],
    platforms: [],
    where: {
      region: null,
      groups: [
        {
          label: 'Comprar o leer',
          items: [
            ...(info.title ? [sophosLink(info.title, info.authors?.[0])] : []),
            {
              name: 'Google Play Libros',
              logo: favicon('play.google.com'),
              url: data.saleInfo?.buyLink ?? info.infoLink ?? `https://play.google.com/store/search?q=${q(searchTerm)}&c=books`,
            },
            { name: 'Amazon', logo: favicon(amazon), url: `https://www.${amazon}/s?k=${q(searchTerm)}&i=stripbooks` },
          ],
        },
      ],
      credit: null,
    },
  }
}

// ---- Open Library (libros de Explorar → Tendencias) --------------------

async function openLibraryDetails(id: string, region: string): Promise<WorkDetails> {
  const base = `https://openlibrary.org/works/${q(id)}`
  const [work, editions] = await Promise.all([
    fetchJson(`${base}.json`) as Promise<{
      title?: string
      description?: string | { value?: string }
      subjects?: string[]
      authors?: { author?: { key?: string } }[]
    }>,
    // Las páginas y el ISBN viven en las ediciones, no en la obra.
    (fetchJson(`${base}/editions.json?limit=20`) as Promise<{
      entries?: { number_of_pages?: number; isbn_13?: string[]; isbn_10?: string[] }[]
    }>).catch(() => ({ entries: [] as { number_of_pages?: number; isbn_13?: string[]; isbn_10?: string[] }[] })),
  ])

  const description = typeof work.description === 'string' ? work.description : work.description?.value ?? ''
  const pages = editions.entries?.find((e) => e.number_of_pages)?.number_of_pages ?? null
  const isbn = editions.entries?.flatMap((e) => [...(e.isbn_13 ?? []), ...(e.isbn_10 ?? [])])[0]
  const searchTerm = isbn ?? work.title ?? ''
  const amazon = AMAZON_DOMAIN[region] ?? 'amazon.com'
  // Las descripciones de Open Library traen a veces enlaces en Markdown y notas "([source]…)".
  const ownOverview = description.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\r/g, '').trim()
  const authorKey = work.authors?.[0]?.author?.key
  const author =
    authorKey && detectLanguage(ownOverview) !== 'es'
      ? await (fetchJson(`https://openlibrary.org${authorKey}.json`) as Promise<{ name?: string }>).then(
          (a) => a.name ?? '',
          () => '',
        )
      : ''

  return {
    overview: await readableOverview(ownOverview, work.title, author),
    facts: pages ? [plural(pages, 'página', 'páginas')] : [],
    people: [],
    cast: [],
    tracks: [],
    pages,
    seasons: [],
    platforms: [],
    where: {
      region: null,
      groups: [
        {
          label: 'Comprar o leer',
          items: [
            // La obra de Open Library no trae el autor sin otra consulta: basta el título.
            ...(work.title ? [sophosLink(work.title)] : []),
            { name: 'Open Library', logo: favicon('openlibrary.org'), url: `https://openlibrary.org/works/${q(id)}` },
            { name: 'Amazon', logo: favicon(amazon), url: `https://www.${amazon}/s?k=${q(searchTerm)}&i=stripbooks` },
          ],
        },
      ],
      credit: null,
    },
  }
}

// ---- RAWG (juegos) ------------------------------------------------------

async function gameDetails(id: string): Promise<WorkDetails | null> {
  const apiKey = process.env.RAWG_API_KEY
  if (!apiKey) return null

  const base = `https://api.rawg.io/api/games/${q(id)}`
  const [data, storeLinks] = await Promise.all([
    fetchJson(`${base}?key=${apiKey}`) as Promise<{
      description_raw?: string
      playtime?: number
      metacritic?: number | null
      platforms?: { platform: { name: string } }[]
      developers?: { name: string }[]
      publishers?: { name: string }[]
      stores?: { store: { id: number; name: string; domain?: string } }[]
    }>,
    // Enlaces directos a la ficha del juego en cada tienda.
    (fetchJson(`${base}/stores?key=${apiKey}`) as Promise<{ results?: { store_id: number; url: string }[] }>).catch(
      () => ({ results: [] as { store_id: number; url: string }[] }),
    ),
  ])

  const urlByStore = new Map((storeLinks.results ?? []).map((s) => [s.store_id, s.url]))
  const stores = (data.stores ?? [])
    .map(({ store }) => ({
      name: store.name,
      logo: store.domain ? favicon(store.domain) : null,
      url: (urlByStore.get(store.id) || (store.domain ? `https://${store.domain}` : '')).replace(/^http:/, 'https:'),
    }))
    .filter((s) => s.url)

  const facts: string[] = []
  const platforms = (data.platforms ?? []).map((p) => p.platform.name)
  if (platforms.length) facts.push(platforms.join(', '))
  if (data.playtime) facts.push(`~${data.playtime} h de juego`)
  if (data.metacritic) facts.push(`Metacritic ${data.metacritic}`)

  const people: WorkDetails['people'] = []
  if (data.developers?.length) people.push({ label: 'Desarrollo', names: data.developers.map((d) => d.name) })
  if (data.publishers?.length) people.push({ label: 'Distribución', names: data.publishers.map((d) => d.name) })

  return {
    overview: data.description_raw?.replace(/\r/g, '').trim() ?? '',
    facts,
    people,
    cast: [],
    tracks: [],
    pages: null,
    seasons: [],
    platforms,
    where: stores.length ? { region: null, groups: [{ label: 'Tiendas', items: stores }], credit: null } : null,
  }
}

// ---- Steam (juegos, respaldo de RAWG) ------------------------------------

async function steamDetails(id: string): Promise<WorkDetails | null> {
  const appId = Number(id)
  if (!Number.isInteger(appId)) return null
  const app = await steamApp(appId)
  if (!app) return null

  const platforms = [
    app.platforms?.windows && 'PC',
    app.platforms?.mac && 'macOS',
    app.platforms?.linux && 'Linux',
  ].filter((p): p is string => !!p)

  const facts: string[] = []
  if (platforms.length) facts.push(platforms.join(', '))
  if (app.metacritic) facts.push(`Metacritic ${app.metacritic.score}`)

  const people: WorkDetails['people'] = []
  if (app.developers?.length) people.push({ label: 'Desarrollo', names: app.developers })
  if (app.publishers?.length) people.push({ label: 'Distribución', names: app.publishers })

  return {
    // La corta es un resumen limpio; la larga suele empezar con publicidad de sus expansiones.
    overview: htmlToText(app.short_description ?? ''),
    facts,
    people,
    cast: [],
    tracks: [],
    pages: null,
    seasons: [],
    platforms,
    where: {
      region: null,
      groups: [
        {
          label: 'Tiendas',
          items: [{ name: 'Steam', logo: favicon('store.steampowered.com'), url: `https://store.steampowered.com/app/${appId}` }],
        },
      ],
      credit: null,
    },
  }
}

// ---- iTunes (música) --------------------------------------------------

interface ItunesItem {
  wrapperType?: string
  collectionName?: string
  artistName?: string
  collectionViewUrl?: string
  trackName?: string
  trackTimeMillis?: number
}

async function albumDetails(id: string, region: string): Promise<WorkDetails | null> {
  const lookup = (country: string) =>
    fetchJson(`https://itunes.apple.com/lookup?id=${q(id)}&entity=song&country=${country}`) as Promise<{
      results?: ItunesItem[]
    }>

  // No todos los álbumes están en la tienda de cada país.
  let results = (await lookup(region)).results ?? []
  if (!results.length && region !== 'US') results = (await lookup('US')).results ?? []
  const album = results.find((r) => r.wrapperType === 'collection')
  if (!album) return null

  const tracks = results
    .filter((r) => r.wrapperType === 'track' && r.trackName)
    .map((r) => ({ name: r.trackName!, duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null }))

  const facts: string[] = []
  if (tracks.length) facts.push(plural(tracks.length, 'canción', 'canciones'))
  const totalSeconds = tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0)
  if (totalSeconds) facts.push(formatMinutes(Math.round(totalSeconds / 60)))

  const term = [album.collectionName, album.artistName].filter(Boolean).join(' ')

  return {
    overview: '',
    facts,
    people: [],
    cast: [],
    tracks,
    pages: null,
    seasons: [],
    platforms: [],
    where: {
      region: null,
      groups: [
        {
          label: 'Escuchar',
          items: [
            {
              name: 'Apple Music',
              logo: favicon('music.apple.com'),
              url: album.collectionViewUrl ?? `https://music.apple.com/search?term=${q(term)}`,
            },
            { name: 'Spotify', logo: favicon('open.spotify.com'), url: `https://open.spotify.com/search/${q(term)}` },
            {
              name: 'YouTube Music',
              logo: favicon('music.youtube.com'),
              url: `https://music.youtube.com/search?q=${q(term)}`,
            },
            { name: 'Deezer', logo: favicon('deezer.com'), url: `https://www.deezer.com/search/${q(term)}` },
          ],
        },
      ],
      credit: null,
    },
  }
}

/**
 * `externalId` como lo guarda MediaEntry ("tmdb:438631", "rawg:3498"…).
 * `region` es un código ISO de país ("MX"): decide las plataformas de
 * películas/series, la tienda de Amazon y el catálogo de iTunes.
 */
export async function getWorkDetails(externalId: string, region: string): Promise<WorkDetails | null> {
  const key = `${externalId}|${region}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  const sep = externalId.indexOf(':')
  const source = externalId.slice(0, sep)
  const id = sep > 0 ? externalId.slice(sep + 1) : ''

  let value: WorkDetails | null = null
  if (id) {
    if (source === 'tmdb') value = await tmdbDetails('movie', id, region)
    else if (source === 'tmdb-tv') value = await tmdbDetails('tv', id, region)
    else if (source === 'googlebooks') value = await bookDetails(id, region)
    else if (source === 'openlibrary') value = await openLibraryDetails(id, region)
    else if (source === 'rawg') value = await gameDetails(id)
    else if (source === 'steam') value = await steamDetails(id)
    else if (source === 'itunes') value = await albumDetails(id, region)
  }

  cache.set(key, { at: Date.now(), value })
  return value
}
