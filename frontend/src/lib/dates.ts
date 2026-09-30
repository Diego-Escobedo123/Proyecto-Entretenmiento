/**
 * Días sin hora ("YYYY-MM-DD"), como los guarda el diario. Se trabajan en la
 * zona horaria del usuario: "hoy" es su hoy, no el del servidor.
 */

/** Una fecha como día local "YYYY-MM-DD". */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Hoy en la zona horaria local, "YYYY-MM-DD" (lo que espera un <input type="date">). */
export function todayISO(): string {
  return isoDay(new Date())
}

/** "2026-09-29" -> Date local a medianoche (sin corrimiento por zona horaria). */
export function parseISODay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "29 sep 2026" */
export function formatDay(day: string): string {
  return parseISODay(day).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 días"; más atrás, la fecha ("12 ago 2026"). */
export function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "Septiembre de 2026" */
export function formatMonth(day: string): string {
  const text = parseISODay(day).toLocaleDateString('es', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}
