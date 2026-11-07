import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/tokens.css'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { useAuthStore } from './stores/auth'
import { initAnalytics } from './lib/analytics'
import { setUnauthorizedHandler } from './lib/api'

// Analítica (PostHog). Sin VITE_POSTHOG_KEY no hace nada.
initAnalytics()

const app = createApp(App).use(createPinia()).use(router)
const auth = useAuthStore()

// El backend rechazó el token (se cambió la contraseña, se borró la cuenta...):
// cierra la sesión aquí también y, si estaba dentro de la app, lo manda al login.
// En las pantallas públicas (p. ej. /verify-email) se queda donde está.
setUnauthorizedHandler(() => {
  if (!auth.isAuthenticated) return
  auth.logout()
  if (!router.currentRoute.value.meta.public) void router.push({ path: '/login', query: { expired: '1' } })
})

// Revalida la sesión guardada contra el backend (no bloquea el arranque).
auth.restore()

app.mount('#app')