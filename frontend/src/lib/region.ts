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

/**
 * Zonas horarias que equivalen a un solo país. El idioma del navegador casi
 * nunca dice "GT" (en Guatemala suele ser "es-419", "es" o "en-US"), pero la
 * zona horaria del dispositivo sí. Sólo lo usan los enlaces que existen en un
 * único país (Sophos); `detectRegion` no cambia.
 */
const TIME_ZONE_COUNTRY: Record<string, string> = {
  'America/Guatemala': 'GT',
}

/** ¿El dispositivo está en ese país, según su zona horaria? */
export function isInCountry(code: string): boolean {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return TIME_ZONE_COUNTRY[zone] === code
  } catch {
    return false
  }
}

/** Nombre del país en español ("MX" -> "México"). */
export function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
