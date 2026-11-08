/**
 * Tienda de Steam: respaldo del catálogo de juegos cuando RAWG no responde
 * (ver `withRawgFallback` en externalSearch.ts). No necesita key y da las
 * fichas en español, pero sólo tiene juegos de PC.
 *
 * Sus listas no sirven tal cual, así que todo pasa por `steamApp`:
 * - "Más vendidos" mezcla hardware (Steam Deck): sólo quedan los `type: game`.
 * - Hay contenido para adultos: se descarta (ver `isSuitable`).
 * - "Próximamente" y "Novedades" son juegos desconocidos sin una sola reseña:
 *   no se usan. Los estrenos salen de "Más vendidos" y "Ofertas".
 * - No hay lista de juegos poco conocidos: Joyas usa una lista curada a mano.
 */
import { fetchJson } from './http'
import type { ExternalResult } from './externalSearch'

const STORE = 'https://store.steampowered.com/api'
/** Español para los textos. País fijo: el catálogo de EE. UU. es el más completo. */
const LOCALE = 'l=spanish&cc=us'
const TIMEOUT_MS = 5000
const APP_TTL = 6 * 60 * 60 * 1000

/**
 * Ids de Steam en `content_descriptors`: 1 algo de desnudos o sexo, 3 sexo sólo
 * para adultos, 4 desnudos o sexo frecuentes. (2 y 5, violencia y contenido
 * maduro general, se permiten: son juegos como Call of Duty).
 */
const ADULT_DESCRIPTORS = new Set([1, 3, 4])

/** Juegos independientes muy bien valorados, para Joyas escondidas. */
const GEM_IDS = [
  1092790, // Inscryption
  553420, // TUNIC
  753640, // Outer Wilds
  632470, // Disco Elysium
  646570, // Slay the Spire
  504230, // Celeste
  391540, // Undertale
  2379780, // Balatro
  1562430, // DREDGE
  1244090, // Sea of Stars
  1123450, // Chicory
  1055540, // A Short Hike
  1578650, // Citizen Sleeper
  972660, // Spiritfarer
  1205520, // Pentiment
  1497440, // COCOON
  367520, // Hollow Knight
  1145360, // Hades
]

export interface SteamAppData {
  type?: string
  name: string
  required_age?: number | string
  short_description?: string
  header_image?: string
  developers?: string[]
  publishers?: string[]
  genres?: { description: string }[]
  metacritic?: { score: number }
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean }
  release_date?: { coming_soon?: boolean; date?: string }
  content_descriptors?: { ids?: number[] }
  recommendations?: { total: number }
}

export interface SteamApp extends SteamAppData {
  id: number
  cover: string | null
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "24 FEB 2017" (como la da Steam en español) -> "2017-02-24". Otros formatos ("T1 2027") -> undefined. */
export function steamReleaseDay(date?: string): string | undefined {
  const match = date?.match(/^(\d{1,2}) ([a-zA-Z]{3})\.?,? (\d{4})$/)
  if (!match) return undefined
  const month = MONTHS.indexOf(match[2].toLowerCase())
  if (month < 0) return undefined
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

function releaseYear(date?: string): number | null {
  const year = date?.match(/\b(?:19|20)\d{2}\b/)?.[0]
  return year ? Number(year) : null
}

/** Es un juego y no tiene contenido sexual: la app se muestra en clase y a cualquier usuario. */
export function isSuitable(app: SteamAppData): boolean {
  if (app.type !== 'game') return false
  if (Number(app.required_age ?? 0) >= 18) return false
  return !(app.content_descriptors?.ids ?? []).some((id) => ADULT_DESCRIPTORS.has(id))
}

/** La portada vertical no existe en los juegos nuevos (da 404): entonces, la horizontal. */
async function resolveCover(id: number, header?: string): Promise<string | null> {
  const portrait = `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`
  try {
    const res = await fetch(portrait, { method: 'HEAD', signal: AbortSignal.timeout(2500) })
    if (res.ok) return portrait
  } catch {
    /* sin portada vertical: se usa la otra */
  }
  return header ?? null
}

const apps = new Map<number, { at: number; app: Promise<SteamApp | null> }>()

async function loadApp(id: number): Promise<SteamApp | null> {
  const body = (await fetchJson(`${STORE}/appdetails?appids=${id}&${LOCALE}`, TIMEOUT_MS)) as Record<
    string,
    { success?: boolean; data?: SteamAppData } | undefined
  >
  const data = body[id]?.success ? body[id]?.data : undefined
  if (!data) return null
  return { ...data, id, name: data.name.replace(/[®™]/g, '').trim(), cover: await resolveCover(id, data.header_image) }
}

/**
 * Ficha de un juego, con caché: las listas piden varias veces los mismos.
 * Se comparte también entre peticiones simultáneas. Si falla, no se guarda.
 */
export function steamApp(id: number): Promise<SteamApp | null> {
  const hit = apps.get(id)
  if (hit && Date.now() - hit.at < APP_TTL) return hit.app
  const app = loadApp(id)
  app.catch(() => apps.delete(id))
  apps.set(id, { at: Date.now(), app })
  return app
}

/** Sólo para pruebas: vacía la caché. */
export function clearSteamCache(): void {
  apps.clear()
}

/** Fichas de los juegos que se pueden mostrar. Uno que falla simplemente no aparece. */
async function suitableApps(ids: number[]): Promise<SteamApp[]> {
  const unique = [...new Set(ids)]
  const found = await Promise.all(unique.map((id) => steamApp(id).catch(() => null)))
  return found.filter((app): app is SteamApp => !!app && isSuitable(app))
}

export function fromSteam(app: SteamApp): ExternalResult {
  return {
    externalId: `steam:${app.id}`,
    title: app.name,
    creator: app.developers?.[0]?.trim() ?? '',
    year: releaseYear(app.release_date?.date),
    cover: app.cover,
    genres: (app.genres ?? []).map((g) => g.description),
  }
}

export async function searchSteam(query: string): Promise<ExternalResult[]> {
  const data = (await fetchJson(
    `${STORE}/storesearch/?term=${encodeURIComponent(query)}&${LOCALE}`,
    TIMEOUT_MS,
  )) as { items?: { id: number }[] }
  const apps = await suitableApps((data.items ?? []).slice(0, 10).map((i) => i.id))
  return apps.map(fromSteam)
}

/** Lo que se está vendiendo ahora: "Más vendidos" y "Ofertas" (ya sin hardware ni contenido para adultos). */
export async function steamTopGames(): Promise<SteamApp[]> {
  const data = (await fetchJson(`${STORE}/featuredcategories?${LOCALE}`, TIMEOUT_MS)) as {
    top_sellers?: { items?: { id: number }[] }
    specials?: { items?: { id: number }[] }
  }
  return suitableApps([...(data.top_sellers?.items ?? []), ...(data.specials?.items ?? [])].map((i) => i.id))
}

export function steamGems(): Promise<SteamApp[]> {
  return suitableApps(GEM_IDS)
}
