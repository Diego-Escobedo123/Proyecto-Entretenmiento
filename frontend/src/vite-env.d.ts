/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del backend (ej. http://localhost:3000). */
  readonly VITE_API_URL: string
  /** Client ID de OAuth de Google. Opcional: sin él no se muestra el botón real. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Project API key de PostHog (empieza con phc_). Opcional: sin ella no se manda analítica. */
  readonly VITE_POSTHOG_KEY?: string
  /** Servidor de PostHog: https://us.i.posthog.com (EE. UU.) o https://eu.i.posthog.com (Europa). */
  readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}