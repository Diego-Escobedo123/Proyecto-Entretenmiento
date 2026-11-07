/**
 * El dato bajo el "Hola, …" de Inicio: algo distinto cada día sacado del
 * diario y las metas, en vez de siempre la misma cifra. Se arma la lista de
 * datos que aplican hoy y se elige uno según el día del año (cambia a diario
 * pero no en cada recarga).
 */
import { isoDay } from './dates'
import type { LogEntry } from '../types/log'

export interface GoalStatus {
  done: number
  target: number
  /** "libro", "película"… ("obra" si es de cualquier tipo). */
  singular: string
  /** "libros", "películas"… */
  plural: string
}

/** Lunes de la semana de `d`, como "YYYY-MM-DD" (las semanas empiezan en lunes). */
function weekKey(d: Date): string {
  const monday = new Date(d)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return isoDay(monday)
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function homeInsights(logs: LogEntry[], goals: GoalStatus[], year: number, now = new Date()): string[] {
  const out: string[] = []
  const thisWeek = weekKey(now)

  // 1. Lo terminado esta semana.
  const finishedThisWeek = logs.filter((l) => l.finishedAt && !l.abandoned && l.finishedAt >= thisWeek).length
  if (finishedThisWeek > 0) out.push(`Esta semana terminaste ${plural(finishedThisWeek, 'obra', 'obras')}.`)

  // 2. Racha: semanas seguidas con algo en el diario (empezar o terminar).
  const activeWeeks = new Set(
    logs.flatMap((l) => [l.startedAt, l.finishedAt]).filter((d): d is string => !!d).map((d) => weekKey(new Date(`${d}T12:00:00`))),
  )
  const cursor = new Date(now)
  if (!activeWeeks.has(thisWeek)) cursor.setDate(cursor.getDate() - 7) // esta semana aún puede sumarse
  let streak = 0
  while (activeWeeks.has(weekKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 7)
  }
  if (streak >= 2) out.push(`Llevas ${streak} semanas seguidas registrando algo.`)

  // 3. Una meta a punto de cumplirse.
  const close = goals
    .map((g) => ({ ...g, left: g.target - g.done }))
    .filter((g) => g.left > 0 && g.left <= 5)
    .sort((a, b) => a.left - b.left)[0]
  if (close) out.push(`Te ${close.left === 1 ? 'falta' : 'faltan'} ${plural(close.left, close.singular, close.plural)} para tu meta de ${year}.`)

  // 4. El género del mes (al menos 2 registros, para que signifique algo).
  const month = isoDay(now).slice(0, 7)
  const genres = new Map<string, number>()
  for (const l of logs) {
    const day = l.finishedAt ?? l.startedAt
    if (!day?.startsWith(month) || !l.entry) continue
    for (const g of l.entry.genres) genres.set(g, (genres.get(g) ?? 0) + 1)
  }
  const [topGenre, topCount] = [...genres.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
  if (topGenre && (topCount ?? 0) >= 2) out.push(`Tu género del mes: ${topGenre}.`)

  // Siempre hay al menos uno.
  const finishedThisYear = logs.filter((l) => l.finishedAt?.startsWith(String(year)) && !l.abandoned).length
  out.push(`Llevas ${plural(finishedThisYear, 'obra terminada', 'obras terminadas')} en ${year}.`)

  return out
}

/** Uno de los datos, el mismo durante todo el día. */
export function insightOfTheDay(insights: string[], now = new Date()): string {
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000)
  return insights[dayOfYear % insights.length]
}
