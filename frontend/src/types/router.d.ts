// Campos propios en `meta` de las rutas (ver router/index.ts).
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Ruta sin sesión (login/register): usa AuthLayout. */
    public?: boolean
    /** Ruta pública que también puede abrir quien ya tiene sesión (p. ej. /verify-email). */
    anyAuth?: boolean
    /** Solo para usuarios con rol ADMIN. */
    admin?: boolean
  }
}