/**
 * Deriva TODO el contenido "cultural" del perfil a partir de las obras reales
 * del usuario: identidad, stats, diario, ADN, obras esenciales, logros y la
 * serie de evolución. Sin datos inventados: si no hay obras, todo viene vacío.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { MEDIA_TYPES, typeMeta } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import type { MediaEntry } from '../types/media'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

export function useCulturalProfile() {
  const store = useMediaStore()
  const { entries, countByType } = storeToRefs(store)

  const worksLogged = computed(() => entries.value.length)

  const statsByType = computed(() =>
    MEDIA_TYPES.map((meta) => ({
      icon: meta.icon,
      label: meta.plural.toLowerCase(),
      value: countByType.value[meta.value],
    })),
  )

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
    pct(entries.value.filter((e) => e.status === 'completed').length, entries.value.length),
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

  const diary = computed(() =>
    [...entries.value]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        date: relativeDate(e.updatedAt),
        title: `${diaryVerb(e)} ${e.title}`,
        note: e.notes.trim() || `${typeMeta(e.type).label} · ${e.creator || 'sin autor'}`,
        rating: e.rating,
        current: isToday(e.updatedAt),
      })),
  )

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
    const completed = entries.value.filter((e) => e.status === 'completed').length
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

  const evolution = computed(() => {
    const now = new Date()
    const buckets: { key: string; label: string; value: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_LABELS[d.getMonth()], value: 0 })
    }
    const indexByKey = new Map(buckets.map((b, i) => [b.key, i]))
    for (const e of entries.value) {
      const d = new Date(e.createdAt)
      const idx = indexByKey.get(`${d.getFullYear()}-${d.getMonth()}`)
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

  return {
    worksLogged,
    statsByType,
    topGenres,
    dominantFormat,
    favoriteDecade,
    completionRate,
    identitySentence,
    diary,
    essentialWorks,
    unlockedAchievements,
    nextAchievement,
    evolution,
  }
}

function diaryVerb(e: MediaEntry): string {
  if (e.status === 'completed') return 'Completaste'
  if (e.status === 'in-progress') return 'Avanzaste en'
  return 'Agregaste a tu lista'
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.floor(days / 7)} semana(s)`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}
