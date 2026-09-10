/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del backend (ej. http://localhost:3000). */
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
