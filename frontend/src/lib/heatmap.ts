/**
 * Celdas del heatmap de "Constancia" (estilo GitHub): un cuadro por día de
 * las últimas ~53 semanas, alineado a domingo, con un nivel 0–4 según cuántos
 * registros del diario hubo ese día.
 */
import { isoDay } from './dates'

export interface HeatmapDay {
  date: string
  count: number
  label: string
  level: number
}

/** `days`: un "YYYY-MM-DD" por cada vez que se empezó o terminó algo (se repiten). */
export function buildHeatmap(days: string[]): HeatmapDay[] {
  const countByDay = new Map<string, number>()
  for (const day of days) countByDay.set(day, (countByDay.get(day) ?? 0) + 1)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - 370)
  start.setDate(start.getDate() - start.getDay()) // retrocede al domingo

  const cells: Omit<HeatmapDay, 'level'>[] = []
  for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const key = isoDay(cursor)
    cells.push({
      date: key,
      count: countByDay.get(key) ?? 0,
      label: cursor.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }),
    })
  }
  const max = Math.max(1, ...cells.map((d) => d.count))
  return cells.map((d) => ({ ...d, level: d.count === 0 ? 0 : Math.min(4, Math.ceil((d.count / max) * 4)) }))
}
