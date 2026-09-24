import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/tokens.css'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App).use(createPinia()).use(router)

// Revalida la sesión guardada contra el backend (no bloquea el arranque).
useAuthStore().restore()

app.mount('#app')
