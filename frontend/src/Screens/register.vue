<script setup lang="ts">
/**
 * Register — nombre/correo/contraseña + confirmación. Auth simulada (ver
 * stores/auth.ts). Al registrarse con éxito, entra directo (sin verificación
 * de correo todavía — ver TODO en el store).
 */
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppField from '../components/AppField.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })
const errors = reactive<{ name?: string; email?: string; password?: string; confirmPassword?: string }>({})
const formError = ref('')
const submitting = ref(false)
const shake = ref(false)

function triggerShake() {
  shake.value = false
  requestAnimationFrame(() => {
    shake.value = true
  })
}

function validate(): boolean {
  errors.name = form.name.trim() ? undefined : 'Ingresa tu nombre.'
  errors.email = form.email.trim() ? undefined : 'Ingresa tu correo.'
  errors.password = form.password.length >= 6 ? undefined : 'Mínimo 6 caracteres.'
  errors.confirmPassword = form.confirmPassword === form.password ? undefined : 'Las contraseñas no coinciden.'
  return !errors.name && !errors.email && !errors.password && !errors.confirmPassword
}

async function onSubmit() {
  formError.value = ''
  if (!validate()) {
    triggerShake()
    return
  }

  submitting.value = true
  const result = await auth.register(form.name.trim(), form.email.trim(), form.password)
  submitting.value = false

  if (result.ok) {
    router.push('/')
  } else {
    formError.value = result.message
    triggerShake()
  }
}
</script>

<template>
  <div class="register" :class="{ 'register--shake': shake }" @animationend="shake = false">
    <h2 class="register__title">Crea tu cuenta</h2>
    <p class="register__subtitle">Empieza a construir tu Perfil Cultural en Mosaic.</p>

    <form class="register__form" @submit.prevent="onSubmit">
      <AppField v-slot="{ id }" label="Nombre" :error="errors.name">
        <input :id="id" v-model="form.name" type="text" class="app-input" placeholder="Tu nombre" autocomplete="name" />
      </AppField>

      <AppField v-slot="{ id }" label="Correo" :error="errors.email">
        <input :id="id" v-model="form.email" type="email" class="app-input" placeholder="tu@correo.com" autocomplete="email" />
      </AppField>

      <AppField v-slot="{ id }" label="Contraseña" :error="errors.password" hint="Mínimo 6 caracteres">
        <input :id="id" v-model="form.password" type="password" class="app-input" placeholder="••••••••" autocomplete="new-password" />
      </AppField>

      <AppField v-slot="{ id }" label="Confirmar contraseña" :error="errors.confirmPassword">
        <input :id="id" v-model="form.confirmPassword" type="password" class="app-input" placeholder="••••••••" autocomplete="new-password" />
      </AppField>

      <p v-if="formError" class="register__form-error">{{ formError }}</p>

      <BaseButton type="submit" :disabled="submitting" class="register__submit">
        <BaseSpinner v-if="submitting" size="sm" />
        {{ submitting ? 'Creando cuenta…' : 'Crear cuenta' }}
      </BaseButton>
    </form>

    <p class="register__footer">
      ¿Ya tienes cuenta? <RouterLink to="/login" class="register__link">Inicia sesión</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.register__title {
  color: var(--color-text);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.register__subtitle {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 var(--space-lg) 0;
}

.register__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.register__form-error {
  color: var(--color-danger);
  font-size: 0.8125rem;
  margin: -4px 0 0 0;
}

.register__submit {
  width: 100%;
  margin-top: var(--space-xs);
}

.register__footer {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: var(--space-lg) 0 0 0;
}

.register__link {
  color: var(--color-link);
  font-weight: 600;
}

.register__link:hover {
  color: var(--color-link-hover);
}

.register--shake {
  animation: register-shake 0.3s ease;
}

@keyframes register-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
</style>