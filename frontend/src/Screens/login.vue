<script setup lang="ts">
/**
 * Login — correo/contraseña + botón de Google.
 *
 * - Correo/contraseña: autenticación simulada (ver stores/auth.ts).
 * - Google: si existe VITE_GOOGLE_CLIENT_ID en .env, se muestra el botón
 *   REAL de Google Identity Services. Si no existe (o el script de Google
 *   no carga), se muestra el botón simulado de antes para no romper nada.
 */
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppField from '../components/AppField.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ email: '', password: '' })
const errors = reactive<{ email?: string; password?: string }>({})
const formError = ref('')
const submitting = ref(false)
const googleLoading = ref(false)
const shake = ref(false)

// --- Google Identity Services ---
const googleButtonEl = ref<HTMLDivElement | null>(null)
const googleStatus = ref<'loading' | 'ready' | 'unavailable'>('loading')
let googleWaitTimer: number | undefined

function triggerShake() {
  shake.value = false
  requestAnimationFrame(() => {
    shake.value = true
  })
}

function validate(): boolean {
  errors.email = form.email.trim() ? undefined : 'Ingresa tu correo.'
  errors.password = form.password ? undefined : 'Ingresa tu contraseña.'
  return !errors.email && !errors.password
}

async function onSubmit() {
  formError.value = ''
  if (!validate()) {
    triggerShake()
    return
  }

  submitting.value = true
  const result = await auth.login(form.email.trim(), form.password)
  submitting.value = false

  if (result.ok) {
    router.push('/')
  } else {
    formError.value = result.message
    triggerShake()
  }
}

/** Botón simulado (solo se usa si Google real no está disponible). */
async function onGoogleLogin() {
  formError.value = ''
  googleLoading.value = true
  const result = await auth.loginWithGoogle()
  googleLoading.value = false

  if (result.ok) {
    router.push('/')
  } else {
    formError.value = result.message
    triggerShake()
  }
}

/** Callback del botón real de Google: recibe el ID token. */
async function onGoogleCredential(response: GoogleCredentialResponse) {
  formError.value = ''
  const result = await auth.loginWithGoogleCredential(response.credential)

  if (result.ok) {
    router.push('/')
  } else {
    formError.value = result.message
    triggerShake()
  }
}

function setupGoogleButton(clientId: string): boolean {
  if (!window.google || !googleButtonEl.value) return false

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: onGoogleCredential,
  })

  // Google acepta un ancho fijo en px (máximo 400).
  const width = Math.min(googleButtonEl.value.offsetWidth || 320, 400)

  window.google.accounts.id.renderButton(googleButtonEl.value, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    width,
    locale: 'es',
  })

  googleStatus.value = 'ready'
  return true
}

onMounted(() => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    googleStatus.value = 'unavailable'
    return
  }

  if (setupGoogleButton(clientId)) return

  // El script de Google carga async: esperamos hasta 5 s a que exista.
  let attempts = 0
  googleWaitTimer = window.setInterval(() => {
    attempts++
    if (setupGoogleButton(clientId)) {
      window.clearInterval(googleWaitTimer)
    } else if (attempts >= 50) {
      window.clearInterval(googleWaitTimer)
      googleStatus.value = 'unavailable'
    }
  }, 100)
})

onBeforeUnmount(() => {
  window.clearInterval(googleWaitTimer)
})
</script>

<template>
  <div class="login" :class="{ 'login--shake': shake }" @animationend="shake = false">
    <h2 class="login__title">Inicia sesión</h2>
    <p class="login__subtitle">Continúa construyendo tu Perfil Cultural.</p>

    <form class="login__form" @submit.prevent="onSubmit">
      <AppField v-slot="{ id }" label="Correo" :error="errors.email">
        <input :id="id" v-model="form.email" type="email" class="app-input" placeholder="tu@correo.com" autocomplete="email" />
      </AppField>

      <AppField v-slot="{ id }" label="Contraseña" :error="errors.password">
        <input :id="id" v-model="form.password" type="password" class="app-input" placeholder="••••••••" autocomplete="current-password" />
      </AppField>

      <p v-if="formError" class="login__form-error">{{ formError }}</p>

      <BaseButton type="submit" :disabled="submitting" class="login__submit">
        <BaseSpinner v-if="submitting" size="sm" />
        {{ submitting ? 'Iniciando sesión…' : 'Iniciar sesión' }}
      </BaseButton>
    </form>

    <div class="login__divider"><span>o</span></div>

    <div class="login__google-wrap">
      <!-- Aquí Google dibuja su botón real -->
      <div
        v-show="googleStatus !== 'unavailable'"
        ref="googleButtonEl"
        class="login__google-gis"
      ></div>

      <!-- Respaldo: botón simulado si no hay Client ID o Google no cargó -->
      <button
        v-if="googleStatus === 'unavailable'"
        class="login__google"
        type="button"
        :disabled="googleLoading"
        @click="onGoogleLogin"
      >
        <BaseSpinner v-if="googleLoading" size="sm" />
        <span v-else>🅶</span>
        {{ googleLoading ? 'Conectando…' : 'Continuar con Google' }}
      </button>
    </div>

    <p class="login__footer">
      ¿No tienes cuenta? <RouterLink to="/register" class="login__link">Regístrate</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.login__title {
  color: var(--color-text);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.login__subtitle {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 var(--space-lg) 0;
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.login__form-error {
  color: var(--color-danger);
  font-size: 0.8125rem;
  margin: -4px 0 0 0;
}

.login__submit {
  width: 100%;
  margin-top: var(--space-xs);
}

.login__divider {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text-subtle);
  font-size: 0.75rem;
  margin: var(--space-lg) 0;
}

.login__divider::before,
.login__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.login__google-wrap {
  width: 100%;
}

/* Reserva espacio mientras Google dibuja el botón (evita saltos). */
.login__google-gis {
  width: 100%;
  min-height: 44px;
  display: flex;
  justify-content: center;
}

.login__google {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  padding: 10px var(--space-md);
  cursor: pointer;
}

.login__google:hover:not(:disabled) {
  background: var(--color-accent-hover-bg);
}

.login__google:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login__footer {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: var(--space-lg) 0 0 0;
}

.login__link {
  color: var(--color-link);
  font-weight: 600;
}

.login__link:hover {
  color: var(--color-link-hover);
}

.login--shake {
  animation: login-shake 0.3s ease;
}

@keyframes login-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
</style>