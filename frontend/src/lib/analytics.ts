/**
 * Analítica con PostHog (https://posthog.com).
 *
 * Todo pasa por aquí para que el resto de la app no dependa de PostHog
 * directamente. Si VITE_POSTHOG_KEY está vacía (por ejemplo en desarrollo),
 * no se inicializa y todas las funciones simplemente no hacen nada.
 *
 * Eventos que se mandan:
 *   user_registered  { method: 'email' | 'google' }  se creó una cuenta nueva
 *   user_logged_in   { method: 'email' | 'google' }  inició sesión con una cuenta que ya existía
 *   $pageview        (automático)                    cada cambio de pantalla
 *
 * A PostHog solo se le manda el id del usuario y su rol, nunca su correo ni
 * su nombre.
 */
import type { PostHog } from 'posthog-js'

export type AnalyticsEvent = 'user_registered' | 'user_logged_in'
export type AuthMethod = 'email' | 'google'

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

/**
 * PostHog se descarga aparte y solo si hay key (import dinámico), para no
 * hacer más pesada la carga inicial de la app. Mientras termina de cargar,
 * las llamadas esperan en orden a que esté listo.
 */
let client: Promise<PostHog | null> | null = null

/** Se llama una vez al arrancar la app (main.ts). */
export function initAnalytics(): void {
  if (!KEY || client) return
  client = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        // Pageviews también al navegar entre pantallas (la app no recarga la página).
        capture_pageview: 'history_change',
        // Solo los eventos que mandamos nosotros, no cada clic.
        autocapture: false,
        disable_session_recording: true,
        // Solo crea perfiles de personas que iniciaron sesión.
        person_profiles: 'identified_only',
      })
      return posthog
    })
    .catch(() => null) // Si no carga (sin internet, bloqueador de anuncios), la app sigue igual.
}

function withClient(fn: (posthog: PostHog) => void): void {
  void client?.then((posthog) => posthog && fn(posthog))
}

/** Asocia los eventos siguientes a este usuario (al iniciar sesión o al volver con sesión guardada). */
export function identifyUser(user: { id: string; role: string }): void {
  withClient((posthog) => posthog.identify(user.id, { role: user.role }))
}

export function track(event: AnalyticsEvent, properties: { method: AuthMethod }): void {
  withClient((posthog) => posthog.capture(event, properties))
}

/** Al cerrar sesión: lo que pase después ya no se asocia a ese usuario. */
export function resetAnalytics(): void {
  withClient((posthog) => posthog.reset())
}