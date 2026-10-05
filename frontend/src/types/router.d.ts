// Campos propios en `meta` de las rutas (ver router/index.ts).
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Ruta sin sesión (login/register): usa AuthLayout. */
    public?: boolean
    /** Solo para usuarios con rol ADMIN. */
    admin?: boolean
  }
}