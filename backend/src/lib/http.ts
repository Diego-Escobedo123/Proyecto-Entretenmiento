/** GET de JSON a una API externa, con timeout. Lanza si la respuesta no es 2xx. */
const TIMEOUT_MS = 6000

export async function fetchJson(url: string, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`${url} -> ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}
