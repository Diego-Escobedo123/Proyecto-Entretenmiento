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
  { value: 'book', label: 'Libro', plural: 'Libros', icon: 'book', creatorLabel: 'Autor/a', gender: 'm' },
  { value: 'game', label: 'Juego', plural: 'Juegos', icon: 'controller', creatorLabel: 'Estudio', gender: 'm' },
  { value: 'music', label: 'Álbum', plural: 'Álbumes', icon: 'disc', creatorLabel: 'Artista', gender: 'm' },
] as const

export interface MediaStatusMeta {
  value: MediaStatus
  label: string
  /** Token CSS para el punto de color en leyendas. */
  color: string
}

export const MEDIA_STATUSES: readonly MediaStatusMeta[] = [
  { value: 'want', label: 'Quiero verla', color: 'var(--color-neutral)' },
  { value: 'in-progress', label: 'En progreso', color: 'var(--color-warning)' },
  { value: 'completed', label: 'Completada', color: 'var(--color-success)' },
] as const

const TYPE_BY_VALUE = new Map(MEDIA_TYPES.map((t) => [t.value, t]))
const STATUS_BY_VALUE = new Map(MEDIA_STATUSES.map((s) => [s.value, s]))

export function typeMeta(value: MediaType): MediaTypeMeta {
  return TYPE_BY_VALUE.get(value) ?? MEDIA_TYPES[0]
}

export function statusMeta(value: MediaStatus): MediaStatusMeta {
  return STATUS_BY_VALUE.get(value) ?? MEDIA_STATUSES[0]
}
