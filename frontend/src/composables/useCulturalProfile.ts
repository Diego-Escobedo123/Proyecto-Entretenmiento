/**
 * Deriva el contenido "cultural" del perfil propio: identidad, ADN, obras
 * esenciales y logros salen de las obras de la colección. Sin datos
 * inventados. (La constancia la arma ConstancyCard con los días del diario.)
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { MEDIA_TYPES, isFinished, typeMeta } from '../lib/catalog'
import { useMediaStore } from '../stores/media'

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

export function useCulturalProfile() {
  const store = useMediaStore()
  const { entries, countByType } = storeToRefs(store)

  const worksLogged = computed(() => entries.value.length)

  const topGenres = computed(() => {
    const tally = new Map<string, number>()
    for (const e of entries.value) for (const g of e.genres) tally.set(g, (tally.get(g) ?? 0) + 1)
    const total = [...tally.values()].reduce((a, b) => a + b, 0)
    // Desempates fijos (iguales a los de backend/src/lib/dna.ts): géneros por nombre.
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
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
    const [decade, count] = [...decades.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]
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

  return {
    worksLogged,
    topGenres,
    dominantFormat,
    favoriteDecade,
    completionRate,
    identitySentence,
    essentialWorks,
    unlockedAchievements,
    nextAchievement,
  }
}
