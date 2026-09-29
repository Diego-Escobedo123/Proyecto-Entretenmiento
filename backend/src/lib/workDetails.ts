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
 * - rawg            RAWG          (juegos)
 * - itunes          iTunes        (álbumes)
 */

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

const TIMEOUT_MS = 6000
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const MAX_CAST = 8

const cache = new Map<string, { at: number; value: WorkDetails | null }>()

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

  const facts: string[] = []
  if (info.pageCount) facts.push(plural(info.pageCount, 'página', 'páginas'))
  if (info.language) {
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
    overview: info.description ? htmlToText(info.description) : '',
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
            {
              name: 'Google Play Libros',
              logo: favicon('play.google.com'),
              url: data.saleInfo?.buyLink ?? info.infoLink ?? `https://play.google.com/store/search?q=${q(searchTerm)}&c=books`,
            },
            { name: 'Amazon', logo: favicon(amazon), url: `https://www.${amazon}/s?k=${q(searchTerm)}&i=stripbooks` },
            { name: 'Goodreads', logo: favicon('goodreads.com'), url: `https://www.goodreads.com/search?q=${q(searchTerm)}` },
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
    else if (source === 'rawg') value = await gameDetails(id)
    else if (source === 'itunes') value = await albumDetails(id, region)
  }

  cache.set(key, { at: Date.now(), value })
  return value
}
