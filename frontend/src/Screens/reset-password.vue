<script setup lang="ts">
/**
 * ResetPassword — destino del enlace de recuperación (/reset-password?token=...).
 *
 * Lee el token, lo saca de la barra de direcciones y pide la contraseña nueva
 * (POST /auth/reset-password, ver stores/auth.ts). Se abre con o sin sesión
 * (`meta.anyAuth`). Las reglas de la contraseña son las mismas del registro.
 */
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppField from '../components/AppField.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = typeof route.query.token === 'string' ? route.query.token : ''
// Fuera de la barra de direcciones (y del historial) apenas se lee.
if (token) void router.replace({ query: {} })

const form = reactive({ password: '', confirmPassword: '' })
const errors = reactive<{ password?: string; confirmPassword?: string }>({})
const formError = ref(token ? '' : 'El enlace está incompleto. Ábrelo de nuevo desde el correo.')
const done = ref(false)
const submitting = ref(false)

function validate(): boolean {
  errors.password = form.password.length >= 6 ? undefined : 'Mínimo 6 caracteres.'
  errors.confirmPassword = form.confirmPassword === form.password ? undefined : 'Las contraseñas no coinciden.'
  return !errors.password && !errors.confirmPassword
}

async function onSubmit() {
  formError.value = ''
  if (!validate()) return

  submitting.value = true
  const result = await auth.resetPassword(token, form.password)
  submitting.value = false

  if (result.ok) done.value = true
  else formError.value = result.message
}

function onContinue() {
  router.push(auth.isAuthenticated ? '/' : '/login')
}
</script>

<template>
  <div class="reset">
    <template v-if="done">
      <h2 class="reset__title">Contraseña actualizada</h2>
      <p class="reset__subtitle" role="status">Ya puedes iniciar sesión con tu contraseña nueva.</p>
      <BaseButton class="reset__submit" @click="onContinue">
        {{ auth.isAuthenticated ? 'Ir a Inicio' : 'Iniciar sesión' }}
      </BaseButton>
    </template>

    <template v-else>
      <h2 class="reset__title">Elige una contraseña nueva</h2>
      <p class="reset__subtitle">Úsala la próxima vez que inicies sesión.</p>

      <form v-if="token" class="reset__form" @submit.prevent="onSubmit">
        <AppField v-slot="{ id }" label="Contraseña nueva" :error="errors.password" hint="Mínimo 6 caracteres">
          <input :id="id" v-model="form.password" type="password" class="app-input" placeholder="••••••••" autocomplete="new-password" />
        </AppField>

        <AppField v-slot="{ id }" label="Repite la contraseña" :error="errors.confirmPassword">
          <input :id="id" v-model="form.confirmPassword" type="password" class="app-input" placeholder="••••••••" autocomplete="new-password" />
        </AppField>

        <p v-if="formError" class="reset__form-error">{{ formError }}</p>

        <BaseButton type="submit" :disabled="submitting" class="reset__submit">
          <BaseSpinner v-if="submitting" size="sm" />
          {{ submitting ? 'Guardando…' : 'Guardar contraseña' }}
        </BaseButton>
      </form>
      <p v-else class="reset__form-error">{{ formError }}</p>

      <p class="reset__footer">
        <RouterLink to="/forgot-password" class="reset__link">Pedir otro enlace</RouterLink>
      </p>
    </template>
  </div>
</template>

<style scoped>
.reset__title {
  color: var(--color-text);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.reset__subtitle {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 var(--space-lg) 0;
}

.reset__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.reset__form-error {
  color: var(--color-danger);
  font-size: 0.8125rem;
  margin: -4px 0 0 0;
}

.reset__submit {
  width: 100%;
  margin-top: var(--space-xs);
}

.reset__footer {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: var(--space-lg) 0 0 0;
}

.reset__link {
  color: var(--color-link);
  font-weight: 600;
}

.reset__link:hover {
  color: var(--color-link-hover);
}
</style>
