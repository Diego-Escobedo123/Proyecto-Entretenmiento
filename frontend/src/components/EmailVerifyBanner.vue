<script setup lang="ts">
/**
 * EmailVerifyBanner — aviso arriba del contenido mientras el correo del
 * usuario no esté verificado. No bloquea nada: solo recuerda abrir el enlace
 * y permite pedir otro (POST /auth/resend-verification; el backend limita a
 * uno por minuto). Se cierra por esta visita con la ✕.
 */
import { computed, ref } from 'vue'
import BaseButton from './BaseButton.vue'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'

const auth = useAuthStore()
const toast = useToastStore()

const dismissed = ref(false)
const sending = ref(false)

const visible = computed(() => !dismissed.value && auth.user?.emailVerified === false)

async function onResend() {
  sending.value = true
  const result = await auth.resendVerification()
  sending.value = false
  if (result.ok) toast.success(result.message)
  else toast.error(result.message)
}
</script>

<template>
  <div v-if="visible" class="verify-banner" role="status">
    <p class="verify-banner__text">
      Confirma tu correo <strong>{{ auth.user?.email }}</strong> con el enlace que te enviamos.
    </p>
    <div class="verify-banner__actions">
      <BaseButton variant="outline" :disabled="sending" @click="onResend">
        {{ sending ? 'Enviando…' : 'Reenviar correo' }}
      </BaseButton>
      <button class="verify-banner__close" type="button" aria-label="Ocultar aviso" @click="dismissed = true">✕</button>
    </div>
  </div>
</template>

<style scoped>
.verify-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  background: var(--color-accent-bg);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
}

.verify-banner__text {
  color: var(--color-text);
  font-size: 0.875rem;
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.verify-banner__actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.verify-banner__close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font: inherit;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.verify-banner__close:hover {
  color: var(--color-text);
  background: var(--color-accent-hover-bg);
}

@media (max-width: 640px) {
  .verify-banner {
    flex-direction: column;
    align-items: stretch;
  }

  .verify-banner__actions {
    justify-content: space-between;
  }
}
</style>
