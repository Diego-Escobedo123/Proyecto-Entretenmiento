/**
 * Resumen de calificaciones (0,5–5): promedio con un decimal e histograma de
 * 10 barras, donde la barra i son (i + 1) medias estrellas (0 → ½, 9 → 5).
 * Lo usan las estadísticas de una obra y el "cómo califica" de un perfil.
 */
export function ratingSummary(values: (number | null)[]) {
  const ratings = values.filter((r): r is number => r != null && r > 0)
  const histogram = Array.from({ length: 10 }, () => 0)
  for (const r of ratings) histogram[Math.min(9, Math.max(0, Math.round(r * 2) - 1))]++
  const average = ratings.length
    ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
    : null
  return { average, count: ratings.length, histogram }
}
