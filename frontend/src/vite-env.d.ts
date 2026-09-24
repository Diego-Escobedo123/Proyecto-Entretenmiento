/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del backend (ej. http://localhost:3000). */
  readonly VITE_API_URL: string
  /** Client ID de OAuth de Google. Opcional: sin él no se muestra el botón real. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
