/**
 * País del usuario, para saber en qué plataformas está disponible una obra
 * (el catálogo de Netflix, Max, etc. cambia por país).
 *
 * Se deduce del idioma del navegador: "es-MX" -> "MX". Si ninguno de los
 * idiomas trae país (p. ej. sólo "es"), se usa `DEFAULT_REGION`.
 */
export const DEFAULT_REGION = 'MX'

export function detectRegion(): string {
  const langs = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  for (const lang of langs) {
    const region = lang?.split('-')[1]
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase()
  }
  return DEFAULT_REGION
}

/** Nombre del país en español ("MX" -> "México"). */
export function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
