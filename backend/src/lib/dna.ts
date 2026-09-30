/**
 * ADN cultural de una colección (el mismo cálculo que hace el frontend para
 * el perfil propio en `useCulturalProfile`): géneros más frecuentes, década
 * favorita, formato dominante y qué tanto termina lo que empieza. Se usa para
 * mostrar el ADN en perfiles públicos ajenos, cuya colección no está en el
 * navegador de quien los visita.
 */
const FINISHED = new Set(['completed', 'mastered'])

const pct = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100))

/**
 * Desempates fijos (iguales a los de `useCulturalProfile` en el frontend, para
 * que el perfil muestre lo mismo lo calcule quien lo calcule): géneros por
 * nombre, décadas la más reciente, tipos en el orden de la app.
 */
const TYPE_ORDER = ['movie', 'series', 'book', 'game', 'music']

export function culturalDna(entries: { genres: string[]; year: number | null; type: string; status: string }[]) {
  const genres = new Map<string, number>()
  for (const e of entries) for (const g of e.genres) genres.set(g, (genres.get(g) ?? 0) + 1)
  const genreTotal = [...genres.values()].reduce((a, b) => a + b, 0)
  const topGenres = [...genres.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .slice(0, 3)
    .map(([name, count]) => ({ name, count, percent: pct(count, genreTotal) }))

  const decades = new Map<number, number>()
  for (const e of entries) {
    if (e.year == null) continue
    const decade = Math.floor(e.year / 10) * 10
    decades.set(decade, (decades.get(decade) ?? 0) + 1)
  }
  const withYear = [...decades.values()].reduce((a, b) => a + b, 0)
  const topDecade = [...decades.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]

  const byType = new Map<string, number>()
  for (const e of entries) byType.set(e.type, (byType.get(e.type) ?? 0) + 1)
  const typeShares = [...byType.entries()]
    .sort((a, b) => b[1] - a[1] || TYPE_ORDER.indexOf(a[0]) - TYPE_ORDER.indexOf(b[0]))
    .map(([type, count]) => ({ type, percent: pct(count, entries.length) }))
  const dominantType = typeShares[0]?.type ?? null

  return {
    topGenres,
    favoriteDecade: topDecade ? { decade: topDecade[0], percent: pct(topDecade[1], withYear) } : null,
    dominantType,
    /** Qué parte de la colección es de cada tipo, de mayor a menor. */
    typeShares,
    completionRate: pct(entries.filter((e) => FINISHED.has(e.status)).length, entries.length),
  }
}
