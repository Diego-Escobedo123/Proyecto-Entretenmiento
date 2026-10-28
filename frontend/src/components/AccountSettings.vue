<script setup lang="ts">
/**
 * AccountSettings — sección "Cuenta" de Ajustes (va dentro de SettingsModal,
 * fuera de su formulario de perfil). Tres bloques, cada uno se despliega al
 * tocar su botón:
 *
 * - Correo: el actual, si está verificado y, si hay, el cambio pendiente.
 *   Cambiarlo pide la contraseña y manda un enlace al correo nuevo.
 * - Contraseña: actual + nueva. Al cambiarla se cierran las demás sesiones.
 *   Quien no sabe la actual (p. ej. entra con Google) puede pedir un enlace
 *   para crear una.
 * - Eliminar cuenta: hay que escribir ELIMINAR; borra todo y manda al login.
 *
 * Todo pasa por stores/auth.ts.
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppField from './AppField.vue'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import { useUiStore } from '../stores/ui'
import { PASSWORD_HINT, emailError, newPasswordError } from '../lib/accountRules'

const auth = useAuthStore()
const toast = useToastStore()
const ui = useUiStore()
const router = useRouter()

type Panel = 'email' | 'password' | 'delete' | null
const open = ref<Panel>(null)

function toggle(panel: Exclude<Panel, null>) {
  open.value = open.value === panel ? null : panel
  resetForms()
}

// --- Correo ---
const emailForm = reactive({ email: '', password: '' })
const emailErrors = reactive<{ email?: string; password?: string; form?: string }>({})
const emailSending = ref(false)

async function submitEmail() {
  emailErrors.form = undefined
  emailErrors.email = emailError(emailForm.email)
  emailErrors.password = emailForm.password ? undefined : 'Ingresa tu contraseña.'
  if (emailErrors.email || emailErrors.password) return

  emailSending.value = true
  const result = await auth.changeEmail(emailForm.email.trim(), emailForm.password)
  emailSending.value = false

  if (result.ok) {
    toast.success(result.message)
    open.value = null
    resetForms()
  } else if (result.field === 'email' || result.field === 'password') {
    emailErrors[result.field] = result.message
  } else {
    emailErrors.form = result.message
  }
}

// --- Contraseña ---
const passwordForm = reactive({ current: '', next: '', confirm: '' })
const passwordErrors = reactive<{ current?: string; next?: string; confirm?: string; form?: string }>({})
const passwordSaving = ref(false)
const setupLinkMessage = ref('')
const setupLinkSending = ref(false)

async function submitPassword() {
  passwordErrors.form = undefined
  passwordErrors.current = passwordForm.current ? undefined : 'Ingresa tu contraseña actual.'
  passwordErrors.next = newPasswordError(passwordForm.next)
  passwordErrors.confirm = passwordForm.confirm === passwordForm.next ? undefined : 'Las contraseñas no coinciden.'
  if (passwordErrors.current || passwordErrors.next || passwordErrors.confirm) return

  passwordSaving.value = true
  const result = await auth.changePassword(passwordForm.current, passwordForm.next)
  passwordSaving.value = false

  if (result.ok) {
    toast.success('Tu contraseña cambió. Se cerraron las sesiones en otros dispositivos.')
    open.value = null
    resetForms()
  } else if (result.field === 'currentPassword') {
    passwordErrors.current = result.message
  } else if (result.field === 'newPassword') {
    passwordErrors.next = result.message
  } else {
    passwordErrors.form = result.message
  }
}

/** Para quien no sabe su contraseña actual: el mismo enlace de "¿Olvidaste tu contraseña?". */
async function sendSetupLink() {
  if (!auth.user) return
  setupLinkSending.value = true
  const result = await auth.forgotPassword(auth.user.email)
  setupLinkSending.value = false
  setupLinkMessage.value = result.ok ? `Te enviamos un enlace a ${auth.user.email}. Caduca en 1 hora.` : result.message
}

// --- Eliminar cuenta ---
const DELETE_WORD = 'ELIMINAR'
const deleteConfirm = ref('')
const deleting = ref(false)
const deleteError = ref<string>()
const canDelete = computed(() => deleteConfirm.value.trim() === DELETE_WORD && !deleting.value)

async function deleteAccount() {
  if (!canDelete.value) return
  deleting.value = true
  deleteError.value = undefined
  const result = await auth.deleteAccount()
  deleting.value = false
  if (!result.ok) {
    deleteError.value = result.message
    return
  }
  ui.closeModal()
  router.push('/login')
}

function resetForms() {
  Object.assign(emailForm, { email: '', password: '' })
  Object.assign(passwordForm, { current: '', next: '', confirm: '' })
  for (const errors of [emailErrors, passwordErrors]) {
    for (const key of Object.keys(errors) as (keyof typeof errors)[]) errors[key] = undefined
  }
  setupLinkMessage.value = ''
  deleteConfirm.value = ''
  deleteError.value = undefined
}
</script>

<template>
  <section class="account" aria-labelledby="account-title">
    <h3 id="account-title" class="account__title">Cuenta</h3>

    <!-- Correo -->
    <div class="account__block">
      <div class="account__head">
        <div class="account__text">
          <span class="account__label">Correo</span>
          <span class="account__value">
            {{ auth.user?.email }}
            <span v-if="auth.user" class="account__tag" :class="{ 'account__tag--warn': !auth.user.emailVerified }">
              {{ auth.user.emailVerified ? 'Verificado' : 'Sin verificar' }}
            </span>
          </span>
          <span v-if="auth.user?.pendingEmail" class="account__hint">
            Esperando que confirmes <strong>{{ auth.user.pendingEmail }}</strong> con el enlace que te enviamos.
          </span>
        </div>
        <button type="button" class="account__btn" @click="toggle('email')">
          {{ open === 'email' ? 'Cancelar' : 'Cambiar' }}
        </button>
      </div>

      <form v-if="open === 'email'" class="account__form" @submit.prevent="submitEmail">
        <AppField v-slot="{ id }" label="Correo nuevo" :error="emailErrors.email">
          <input :id="id" v-model="emailForm.email" type="email" class="app-input" autocomplete="email" />
        </AppField>
        <AppField v-slot="{ id }" label="Tu contraseña" :error="emailErrors.password">
          <input :id="id" v-model="emailForm.password" type="password" class="app-input" autocomplete="current-password" />
        </AppField>
        <p v-if="emailErrors.form" class="account__error" role="alert">{{ emailErrors.form }}</p>
        <p class="account__hint">Te enviaremos un enlace al correo nuevo. Hasta que lo abras, sigues entrando con el actual.</p>
        <button type="submit" class="account__btn account__btn--solid" :disabled="emailSending">
          {{ emailSending ? 'Enviando…' : 'Enviar enlace' }}
        </button>
      </form>
    </div>

    <!-- Contraseña -->
    <div class="account__block">
      <div class="account__head">
        <div class="account__text">
          <span class="account__label">Contraseña</span>
          <span class="account__hint">Al cambiarla se cierran las sesiones en otros dispositivos.</span>
        </div>
        <button type="button" class="account__btn" @click="toggle('password')">
          {{ open === 'password' ? 'Cancelar' : 'Cambiar' }}
        </button>
      </div>

      <form v-if="open === 'password'" class="account__form" @submit.prevent="submitPassword">
        <AppField v-slot="{ id }" label="Contraseña actual" :error="passwordErrors.current">
          <input :id="id" v-model="passwordForm.current" type="password" class="app-input" autocomplete="current-password" />
        </AppField>
        <AppField v-slot="{ id }" label="Contraseña nueva" :error="passwordErrors.next" :hint="PASSWORD_HINT">
          <input :id="id" v-model="passwordForm.next" type="password" class="app-input" autocomplete="new-password" />
        </AppField>
        <AppField v-slot="{ id }" label="Repite la contraseña nueva" :error="passwordErrors.confirm">
          <input :id="id" v-model="passwordForm.confirm" type="password" class="app-input" autocomplete="new-password" />
        </AppField>
        <p v-if="passwordErrors.form" class="account__error" role="alert">{{ passwordErrors.form }}</p>
        <button type="submit" class="account__btn account__btn--solid" :disabled="passwordSaving">
          {{ passwordSaving ? 'Guardando…' : 'Guardar contraseña' }}
        </button>

        <p class="account__hint">
          ¿No sabes tu contraseña actual (por ejemplo, si entras con Google)?
          <button type="button" class="account__link" :disabled="setupLinkSending" @click="sendSetupLink">
            {{ setupLinkSending ? 'Enviando…' : 'Te enviamos un enlace para crear una' }}
          </button>
        </p>
        <p v-if="setupLinkMessage" class="account__hint" role="status">{{ setupLinkMessage }}</p>
      </form>
    </div>

    <!-- Eliminar cuenta -->
    <div class="account__block account__block--danger">
      <div class="account__head">
        <div class="account__text">
          <span class="account__label">Eliminar cuenta</span>
          <span class="account__hint">
            Se borran tu perfil, tu colección, tu diario, tus listas y tus seguidores. No se puede deshacer.
          </span>
        </div>
        <button type="button" class="account__btn account__btn--danger-outline" @click="toggle('delete')">
          {{ open === 'delete' ? 'Cancelar' : 'Eliminar…' }}
        </button>
      </div>

      <form v-if="open === 'delete'" class="account__form account__form--inline" @submit.prevent="deleteAccount">
        <AppField v-slot="{ id }" :label="`Escribe ${DELETE_WORD} para confirmar`" :error="deleteError">
          <input :id="id" v-model="deleteConfirm" class="app-input" autocomplete="off" spellcheck="false" />
        </AppField>
        <button type="submit" class="account__btn account__btn--danger" :disabled="!canDelete">
          {{ deleting ? 'Eliminando…' : 'Eliminar mi cuenta' }}
        </button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.account {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
}

.account__title {
  margin: 0 0 var(--space-xs) 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--color-text);
}

.account__block {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--color-bg);
}

.account__block--danger {
  background: none;
  border: 1px solid var(--color-danger);
}

.account__head {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.account__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account__label {
  font-weight: 800;
  color: var(--color-text);
}

.account__value {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
  color: var(--color-text);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.account__tag {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  background: var(--color-surface-2);
  color: var(--color-success);
}

.account__tag--warn {
  color: var(--color-warning);
}

.account__hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.account__error {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-danger);
}

.account__form {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-md);
}

.account__form > .account__btn {
  align-self: flex-start;
}

.account__form--inline {
  flex-direction: row;
  align-items: flex-end;
  gap: var(--space-sm);
}

.account__form--inline > :first-child {
  flex: 1;
  min-width: 0;
}

.account__form--inline > .account__btn {
  align-self: auto;
}

.account__btn {
  flex-shrink: 0;
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-text);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
}

.account__btn:hover:not(:disabled) {
  background: var(--color-accent-hover-bg);
}

.account__btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.account__btn--solid {
  border-color: var(--fig-cream);
  background: var(--fig-cream);
  color: var(--fig-purple);
}

.account__btn--solid:hover:not(:disabled) {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.account__btn--danger-outline {
  border-color: var(--color-danger);
  background: none;
  color: var(--color-danger);
}

.account__btn--danger-outline:hover:not(:disabled) {
  background: var(--color-danger);
  color: var(--fig-cream);
}

.account__btn--danger {
  border-color: var(--color-danger);
  background: var(--color-danger);
  color: var(--fig-cream);
}

.account__btn--danger:hover:not(:disabled) {
  background: var(--color-danger);
}

.account__link {
  padding: 0;
  border: none;
  background: none;
  color: var(--color-link);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.account__link:hover:not(:disabled) {
  color: var(--color-link-hover);
}

@media (max-width: 560px) {
  .account__head,
  .account__form--inline {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
