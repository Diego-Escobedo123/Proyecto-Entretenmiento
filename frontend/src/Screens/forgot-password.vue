<script setup lang="ts">
/**
 * ForgotPassword — pide el enlace para restablecer la contraseña
 * (POST /auth/forgot-password, ver stores/auth.ts).
 *
 * El backend responde lo mismo exista o no la cuenta, así que aquí siempre se
 * muestra el mismo aviso de "revisa tu correo".
 */
import { reactive, ref } from 'vue'
import AppField from '../components/AppField.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const form = reactive({ email: '' })
const errors = reactive<{ email?: string }>({})
const formError = ref('')
const sentMessage = ref('')
const submitting = ref(false)

async function onSubmit() {
  formError.value = ''
  errors.email = form.email.trim() ? undefined : 'Ingresa tu correo.'
  if (errors.email) return

  submitting.value = true
  const result = await auth.forgotPassword(form.email.trim())
  submitting.value = false

  if (result.ok) sentMessage.value = result.message
  else formError.value = result.message
}
</script>

<template>
  <div class="forgot">
    <h2 class="forgot__title">Recupera tu contraseña</h2>

    <template v-if="sentMessage">
      <p class="forgot__subtitle" role="status">{{ sentMessage }} El enlace caduca en 1 hora.</p>
      <p class="forgot__hint">¿No llega? Revisa la carpeta de spam o vuelve a intentarlo en un minuto.</p>
    </template>

    <template v-else>
      <p class="forgot__subtitle">Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una nueva.</p>

      <form class="forgot__form" @submit.prevent="onSubmit">
        <AppField v-slot="{ id }" label="Correo" :error="errors.email">
          <input :id="id" v-model="form.email" type="email" class="app-input" placeholder="tu@correo.com" autocomplete="email" />
        </AppField>

        <p v-if="formError" class="forgot__form-error">{{ formError }}</p>

        <BaseButton type="submit" :disabled="submitting" class="forgot__submit">
          <BaseSpinner v-if="submitting" size="sm" />
          {{ submitting ? 'Enviando…' : 'Enviar enlace' }}
        </BaseButton>
      </form>
    </template>

    <p class="forgot__footer">
      <RouterLink to="/login" class="forgot__link">Volver a iniciar sesión</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.forgot__title {
  color: var(--color-text);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.forgot__subtitle {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 var(--space-lg) 0;
}

.forgot__hint {
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
  margin: calc(-1 * var(--space-sm)) 0 0 0;
}

.forgot__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.forgot__form-error {
  color: var(--color-danger);
  font-size: 0.8125rem;
  margin: -4px 0 0 0;
}

.forgot__submit {
  width: 100%;
  margin-top: var(--space-xs);
}

.forgot__footer {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: var(--space-lg) 0 0 0;
}

.forgot__link {
  color: var(--color-link);
  font-weight: 600;
}

.forgot__link:hover {
  color: var(--color-link-hover);
}
</style>
