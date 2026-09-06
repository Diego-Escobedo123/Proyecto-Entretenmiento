/**
 * Wrapper mínimo y tipado sobre localStorage con JSON.
 * Tolera entornos sin localStorage (SSR, modo privado, storage lleno):
 * nunca lanza, sólo devuelve el fallback.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage no disponible o lleno: se ignora, la app sigue en memoria */
  }
}

/** Simula latencia de red para que los estados de carga sean visibles y realistas. */
export function delay(ms = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** ID único sin dependencias externas. */
export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
