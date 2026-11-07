/**
 * Seguimiento específico por tipo: cómo se traduce "página 120 de 300" o
 * "T2 · E5" a un porcentaje, y cómo se resume en una línea para las tarjetas.
 */
import type { MediaEntry } from '../types/media'

export type SeasonInfo = { number: number; episodes: number }

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

export function bookProgress(pagesRead: number | null, pagesTotal: number | null): number | null {
  if (pagesRead == null || !pagesTotal) return null
  return clampPct((pagesRead / pagesTotal) * 100)
}

/** Episodios vistos (todas las temporadas anteriores + el actual) sobre el total de la serie. */
export function seriesProgress(seasons: SeasonInfo[], season: number | null, episode: number | null): number | null {
  if (season == null || episode == null || !seasons.length) return null
  const total = seasons.reduce((sum, s) => sum + s.episodes, 0)
  if (!total) return null
  const before = seasons.filter((s) => s.number < season).reduce((sum, s) => sum + s.episodes, 0)
  return clampPct(((before + episode) / total) * 100)
}

function formatHours(hours: number): string {
  return `${hours.toLocaleString('es', { maximumFractionDigits: 1 })} h`
}

/** Resumen corto del avance: "p. 120 de 300", "T2 · E5", "12 h · PS5". `null` si no hay datos. */
export function progressSummary(entry: MediaEntry): string | null {
  switch (entry.type) {
    case 'book':
      if (entry.pagesRead == null) return null
      return entry.pagesTotal ? `p. ${entry.pagesRead} de ${entry.pagesTotal}` : `p. ${entry.pagesRead}`
    case 'series':
      if (entry.season == null) return null
      return entry.episode != null ? `T${entry.season} · E${entry.episode}` : `T${entry.season}`
    case 'game': {
      const parts = [entry.hoursPlayed != null ? formatHours(entry.hoursPlayed) : null, entry.platform]
      const text = parts.filter(Boolean).join(' · ')
      return text || null
    }
    default:
      return null
  }
}

/**
 * El episodio que sigue al actual ("+1 episodio" en Inicio). Si se termina
 * la temporada pasa a la siguiente; `last` indica que ya era el último
 * episodio de la serie (no hay siguiente). Sin temporadas conocidas, sólo suma.
 */
export function nextEpisode(
  seasons: SeasonInfo[],
  season: number | null,
  episode: number | null,
): { season: number; episode: number; last: boolean } {
  const s = season ?? 1
  if (episode == null) return { season: s, episode: 1, last: false }
  const current = seasons.find((x) => x.number === s)
  if (current && episode >= current.episodes) {
    const next = seasons.filter((x) => x.number > s).sort((a, b) => a.number - b.number)[0]
    if (next) return { season: next.number, episode: 1, last: false }
    return { season: s, episode, last: true }
  }
  return { season: s, episode: episode + 1, last: false }
}

/** Ya llegó al final: último episodio de la serie o última página del libro. */
export function reachedEnd(entry: MediaEntry, seasons: SeasonInfo[]): boolean {
  if (entry.type === 'book') return !!entry.pagesTotal && (entry.pagesRead ?? 0) >= entry.pagesTotal
  if (entry.type === 'series' && entry.season != null && entry.episode != null && seasons.length) {
    const lastSeason = Math.max(...seasons.map((x) => x.number))
    const episodes = seasons.find((x) => x.number === lastSeason)?.episodes ?? 0
    return entry.season >= lastSeason && entry.episode >= episodes
  }
  return false
}
