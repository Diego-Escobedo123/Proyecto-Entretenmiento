/**
 * Catálogo de metadatos de presentación para tipos y estados.
 * Centraliza etiquetas, íconos y colores para no repetirlos en cada screen.
 */
import type { MediaStatus, MediaType } from '../types/media'

export interface MediaTypeMeta {
  value: MediaType
  label: string
  /** Sustantivo en plural para títulos ("42 Libros"). */
  plural: string
  /** Nombre de Bootstrap Icons (sin el prefijo `bi-`). */
  icon: string
  /** Cómo se llama a quien la crea, para el label del formulario. */
  creatorLabel: string
  /** Género gramatical del `label`, para concordar textos generados. */
  gender: 'm' | 'f'
}

export const MEDIA_TYPES: readonly MediaTypeMeta[] = [
  { value: 'movie', label: 'Película', plural: 'Películas', icon: 'film', creatorLabel: 'Dirección', gender: 'f' },
  { value: 'series', label: 'Serie', plural: 'Series', icon: 'tv', creatorLabel: 'Creación', gender: 'f' },
  { value: 'book', label: 'Libro', plural: 'Libros', icon: 'book', creatorLabel: 'Autor/a', gender: 'm' },
  { value: 'game', label: 'Juego', plural: 'Juegos', icon: 'controller', creatorLabel: 'Estudio', gender: 'm' },
  { value: 'music', label: 'Álbum', plural: 'Álbumes', icon: 'disc', creatorLabel: 'Artista', gender: 'm' },
] as const

export interface MediaStatusMeta {
  value: MediaStatus
  /** Etiqueta genérica, para filtros que mezclan tipos. */
  label: string
  /** Token CSS para el punto de color en leyendas. */
  color: string
}

export const MEDIA_STATUSES: readonly MediaStatusMeta[] = [
  { value: 'want', label: 'Pendiente', color: 'var(--color-neutral)' },
  { value: 'in-progress', label: 'En progreso', color: 'var(--color-warning)' },
  { value: 'completed', label: 'Completada', color: 'var(--color-success)' },
  { value: 'mastered', label: 'Al 100%', color: 'var(--color-accent)' },
  { value: 'abandoned', label: 'Abandonada', color: 'var(--color-text-subtle)' },
] as const

/**
 * Estados válidos de cada tipo y cómo se llaman ahí (como en Letterboxd,
 * Goodreads o Backloggd). El orden es el del selector del formulario.
 */
const STATUS_LABELS: Record<MediaType, Partial<Record<MediaStatus, string>>> = {
  movie: { want: 'Quiero verla', completed: 'Vista' },
  series: { want: 'Quiero verla', 'in-progress': 'Viendo', completed: 'Terminada', abandoned: 'Abandonada' },
  book: { want: 'Quiero leerlo', 'in-progress': 'Leyendo', completed: 'Leído', abandoned: 'Abandonado' },
  game: {
    want: 'Quiero jugarlo',
    'in-progress': 'Jugando',
    completed: 'Terminado',
    mastered: 'Completado al 100%',
    abandoned: 'Abandonado',
  },
  music: { want: 'Quiero escucharlo', completed: 'Escuchado' },
}

const TYPE_BY_VALUE = new Map(MEDIA_TYPES.map((t) => [t.value, t]))
const STATUS_BY_VALUE = new Map(MEDIA_STATUSES.map((s) => [s.value, s]))

export function typeMeta(value: MediaType): MediaTypeMeta {
  return TYPE_BY_VALUE.get(value) ?? MEDIA_TYPES[0]
}

export function statusMeta(value: MediaStatus): MediaStatusMeta {
  return STATUS_BY_VALUE.get(value) ?? MEDIA_STATUSES[0]
}

/** Estados que se ofrecen para un tipo, con su etiqueta propia. */
export function statusesFor(type: MediaType): { value: MediaStatus; label: string }[] {
  return Object.entries(STATUS_LABELS[type]).map(([value, label]) => ({ value: value as MediaStatus, label }))
}

/** "Leído", "Jugando"… Si el estado no es propio del tipo (datos viejos), la etiqueta genérica. */
export function statusLabel(type: MediaType, status: MediaStatus): string {
  return STATUS_LABELS[type][status] ?? statusMeta(status).label
}

/** Terminada, sea normal o al 100%: cuenta como completada en estadísticas y logros. */
export function isFinished(status: MediaStatus): boolean {
  return status === 'completed' || status === 'mastered'
}
