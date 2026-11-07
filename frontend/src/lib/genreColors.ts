/**
 * Colores de los géneros del ADN cultural, en el orden del ranking (el más
 * frecuente primero). Los usan la dona del ADN y "Tu año en obras", así un
 * género tiene el mismo color en las dos gráficas. Lo que queda fuera del
 * top 3 va como "Otros".
 */
export const GENRE_COLORS = ['var(--color-accent)', 'var(--fig-stem-green)', 'var(--rose)'] as const

export const OTHER_GENRES_COLOR = 'color-mix(in srgb, var(--color-text) 34%, var(--color-surface))'

export const OTHER_GENRES_LABEL = 'Otros'
