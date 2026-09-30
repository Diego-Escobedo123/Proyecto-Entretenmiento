/**
 * Deriva el contenido "cultural" del perfil: identidad, ADN, obras
 * esenciales y logros salen de las obras de la colección; la constancia
 * (heatmap) y la evolución salen del diario, igual que el resumen del año,
 * para que todas las pantallas cuenten lo mismo. Sin datos inventados.
 */
import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { MEDIA_TYPES, isFinished, typeMeta } from '../lib/catalog'
import { isoDay } from '../lib/dates'
import { useMediaStore } from '../stores/media'
import type { LogEntry } from '../types/log'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

/** Días del diario con actividad: cuándo se empezó o terminó algo. */
function activityDays(logs: LogEntry[]): string[] {
  return logs.flatMap((l) => [l.startedAt, l.finishedAt].filter((d): d is string => Boolean(d)))
}

export function useCulturalProfile(logs: Ref<LogEntry[]>) {
  const store = useMediaStore()
  const { entries, countByType } = storeToRefs(store)

  const worksLogged = computed(() => entries.value.length)

  const topGenres = computed(() => {
    const tally = new Map<string, number>()
    for (const e of entries.value) for (const g of e.genres) tally.set(g, (tally.get(g) ?? 0) + 1)
    const total = [...tally.values()].reduce((a, b) => a + b, 0)
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count, percent: pct(count, total) }))
  })

  const dominantFormat = computed(() => {
    const ranked = MEDIA_TYPES.map((m) => ({ meta: m, count: countByType.value[m.value] }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
    return ranked[0]?.meta ?? null
  })

  const favoriteDecade = computed(() => {
    const decades = new Map<number, number>()
    for (const e of entries.value) {
      if (e.year == null) continue
      const decade = Math.floor(e.year / 10) * 10
      decades.set(decade, (decades.get(decade) ?? 0) + 1)
    }
    if (decades.size === 0) return null
    const withYear = [...decades.values()].reduce((a, b) => a + b, 0)
    const [decade, count] = [...decades.entries()].sort((a, b) => b[1] - a[1])[0]
    return { decade, percent: pct(count, withYear) }
  })

  const completionRate = computed(() =>
    pct(entries.value.filter((e) => isFinished(e.status)).length, entries.value.length),
  )

  const identitySentence = computed(() => {
    if (entries.value.length === 0) return ''
    const parts: string[] = []
    const genres = topGenres.value
    if (genres.length >= 2) {
      parts.push(`Te inclinas por ${genres[0].name} y ${genres[1].name}`)
    } else if (genres.length === 1) {
      parts.push(`${genres[0].name} domina lo que registras`)
    }
    if (dominantFormat.value) {
      parts.push(`Tu formato principal son ${dominantFormat.value.plural.toLowerCase()}`)
    }
    parts.push(`Completas el ${completionRate.value}% de lo que empiezas`)
    return parts.map((p) => p.replace(/^./, (c) => c.toUpperCase())).join('. ') + '.'
  })

  const essentialWorks = computed(() => {
    const ranked = entries.value.some((e) => e.favorite)
      ? entries.value.filter((e) => e.favorite)
      : [...entries.value].filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    return ranked.slice(0, 4).map((e) => ({
      id: e.id,
      title: e.title,
      subtitle: e.creator || typeMeta(e.type).label,
      cover: e.cover,
    }))
  })

  const achievements = computed(() => {
    const total = entries.value.length
    const completed = entries.value.filter((e) => isFinished(e.status)).length
    const list: { label: string; done: boolean }[] = [
      { label: 'Primera obra registrada', done: total >= 1 },
      { label: '10 obras documentadas', done: total >= 10 },
      { label: '25 obras documentadas', done: total >= 25 },
      { label: '50 obras documentadas', done: total >= 50 },
      { label: 'Primera obra completada', done: completed >= 1 },
      { label: '10 obras completadas', done: completed >= 10 },
    ]
    for (const m of MEDIA_TYPES) {
      const [art, suffix] = m.gender === 'f' ? ['Primera', 'a'] : ['Primer', 'o']
      list.push({
        label: `${art} ${m.label.toLowerCase()} registrad${suffix}`,
        done: countByType.value[m.value] >= 1,
      })
    }
    return list
  })

  const unlockedAchievements = computed(() => achievements.value.filter((a) => a.done))
  const nextAchievement = computed(() => achievements.value.find((a) => !a.done) ?? null)

  /** Obras terminadas por mes en los últimos 12 meses (del diario). */
  const evolution = computed(() => {
    const now = new Date()
    const buckets: { key: string; label: string; value: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ key: isoDay(d).slice(0, 7), label: MONTH_LABELS[d.getMonth()], value: 0 })
    }
    const indexByKey = new Map(buckets.map((b, i) => [b.key, i]))
    for (const log of logs.value) {
      if (!log.finishedAt || log.abandoned) continue
      const idx = indexByKey.get(log.finishedAt.slice(0, 7))
      if (idx != null) buckets[idx].value++
    }
    const firstHalf = buckets.slice(0, 6).reduce((a, b) => a + b.value, 0)
    const secondHalf = buckets.slice(6).reduce((a, b) => a + b.value, 0)
    return {
      months: buckets.map((b) => b.label),
      values: buckets.map((b) => b.value),
      total: buckets.reduce((a, b) => a + b.value, 0),
      trendPercent: firstHalf === 0 ? null : pct(secondHalf - firstHalf, firstHalf),
    }
  })

  /** Constancia: días con actividad en el diario (últimas ~53 semanas, alineado a domingo). */
  const activityHeatmap = computed(() => {
    const countByDay = new Map<string, number>()
    for (const day of activityDays(logs.value)) countByDay.set(day, (countByDay.get(day) ?? 0) + 1)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(start.getDate() - 370)
    start.setDate(start.getDate() - start.getDay()) // retrocede al domingo

    const days: { date: string; count: number; label: string }[] = []
    for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
      const key = isoDay(cursor)
      days.push({
        date: key,
        count: countByDay.get(key) ?? 0,
        label: cursor.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }),
      })
    }
    const max = Math.max(1, ...days.map((d) => d.count))
    return days.map((d) => ({ ...d, level: d.count === 0 ? 0 : Math.min(4, Math.ceil((d.count / max) * 4)) }))
  })

  return {
    worksLogged,
    topGenres,
    dominantFormat,
    favoriteDecade,
    completionRate,
    identitySentence,
    activityHeatmap,
    essentialWorks,
    unlockedAchievements,
    nextAchievement,
    evolution,
  }
}
