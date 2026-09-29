/**
 * Días sin hora ("YYYY-MM-DD"), como los guarda el diario. Se trabajan en la
 * zona horaria del usuario: "hoy" es su hoy, no el del servidor.
 */

/** Hoy en la zona horaria local, "YYYY-MM-DD" (lo que espera un <input type="date">). */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

/** "Septiembre de 2026" */
export function formatMonth(day: string): string {
  const text = parseISODay(day).toLocaleDateString('es', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}
