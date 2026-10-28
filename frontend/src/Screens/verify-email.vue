<script setup lang="ts">
/**
 * VerifyEmail — destino del enlace que llega al correo (/verify-email?token=...).
 *
 * Manda el token a POST /auth/verify-email (ver stores/auth.ts) y muestra el
 * resultado. Se abre con o sin sesión (`meta.anyAuth`): el enlace puede
 * abrirse en otro navegador. Si falla y hay sesión sin verificar, ofrece
 * pedir otro enlace.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const status = ref<'loading' | 'ok' | 'error'>('loading')
const message = ref('')
const resending = ref(false)
const resendMessage = ref('')

const canResend = computed(() => auth.isAuthenticated && auth.user?.emailVerified === false)

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : ''
  // Fuera de la barra de direcciones (y del historial) apenas se lee.
  if (token) void router.replace({ query: {} })
  if (!token) {
    status.value = 'error'
    message.value = 'El enlace está incompleto. Ábrelo de nuevo desde el correo.'
    return
  }

  // Si hay sesión, primero se conoce al usuario: así verifyEmail puede actualizarlo.
  if (auth.isAuthenticated && !auth.user) await auth.restore()

  const result = await auth.verifyEmail(token)
  if (result.ok) {
    status.value = 'ok'
  } else {
    status.value = 'error'
    message.value = result.message
  }
})

async function onResend() {
  resending.value = true
  resendMessage.value = (await auth.resendVerification()).message
  resending.value = false
}

function onContinue() {
  router.push(auth.isAuthenticated ? '/' : '/login')
}
</script>

<template>
  <div class="verify">
    <template v-if="status === 'loading'">
      <h2 class="verify__title">Verificando tu correo…</h2>
      <p class="verify__status" role="status">
        <BaseSpinner size="sm" />
        Un momento.
      </p>
    </template>

    <template v-else-if="status === 'ok'">
      <h2 class="verify__title">¡Correo verificado!</h2>
      <p class="verify__subtitle">Tu cuenta quedó confirmada.</p>
      <BaseButton class="verify__action" @click="onContinue">
        {{ auth.isAuthenticated ? 'Ir a Inicio' : 'Iniciar sesión' }}
      </BaseButton>
    </template>

    <template v-else>
      <h2 class="verify__title">No se pudo verificar</h2>
      <p class="verify__error">{{ message }}</p>

      <template v-if="canResend">
        <BaseButton class="verify__action" :disabled="resending" @click="onResend">
          <BaseSpinner v-if="resending" size="sm" />
          {{ resending ? 'Enviando…' : 'Enviar un enlace nuevo' }}
        </BaseButton>
        <p v-if="resendMessage" class="verify__subtitle verify__subtitle--after" role="status">{{ resendMessage }}</p>
      </template>

      <BaseButton variant="outline" class="verify__action" @click="onContinue">
        {{ auth.isAuthenticated ? 'Ir a Inicio' : 'Iniciar sesión' }}
      </BaseButton>
    </template>
  </div>
</template>

<style scoped>
.verify {
  display: flex;
  flex-direction: column;
  text-align: center;
}

.verify__title {
  color: var(--color-text);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.verify__subtitle {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 var(--space-lg) 0;
}

.verify__subtitle--after {
  margin: var(--space-sm) 0 0 0;
}

.verify__status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: var(--space-sm) 0 0 0;
}

.verify__error {
  color: var(--color-danger);
  font-size: 0.875rem;
  margin: 0 0 var(--space-lg) 0;
}

.verify__action {
  width: 100%;
}

.verify__action + .verify__action,
.verify__subtitle--after + .verify__action {
  margin-top: var(--space-sm);
}
</style>
