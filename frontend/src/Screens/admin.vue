<script setup lang="ts">
/**
 * Administración — solo para usuarios con rol ADMIN (guard en el router y
 * 403 en el backend). Muestra números generales de Mosaic y la lista de
 * usuarios, donde un admin puede dar o quitar el rol de admin y eliminar
 * cuentas. Un admin no puede cambiar su propio rol ni borrarse a sí mismo.
 */
import { computed, onMounted, ref, watch } from 'vue'
import BaseButton from '../components/BaseButton.vue'
import BaseIcon from '../components/BaseIcon.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import StatCard from '../components/StatCard.vue'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'
import { ApiError } from '../lib/api'
import { adminService } from '../services/adminService'
import { useAuthStore } from '../stores/auth'
import type { AdminStats, AdminUser, Role } from '../types/admin'

const auth = useAuthStore()

// --- Números generales ---
const stats = ref<AdminStats | null>(null)

async function loadStats() {
  try {
    stats.value = await adminService.stats()
  } catch {
    stats.value = null
  }
}

const statCards = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { icon: 'people', value: s.users, label: s.users === 1 ? 'Usuario' : 'Usuarios' },
    { icon: 'shield-lock', value: s.admins, label: s.admins === 1 ? 'Admin' : 'Admins' },
    { icon: 'person-plus', value: s.newUsers, label: 'Nuevos esta semana' },
    { icon: 'collection', value: s.entries, label: 'Obras registradas' },
    { icon: 'chat-quote', value: s.reviews, label: 'Reseñas' },
    { icon: 'card-list', value: s.lists, label: 'Listas' },
  ]
})

// --- Usuarios ---
type RoleFilter = 'ALL' | Role
const ROLE_TABS: { value: RoleFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'USER', label: 'Usuarios' },
]

const query = ref('')
const roleFilter = ref<RoleFilter>('ALL')
const { debouncedQuery, isSearching } = useDebouncedSearch(query, 300)

const users = ref<AdminUser[]>([])
const loading = ref(true)
const loadError = ref('')
let requestId = 0

async function loadUsers() {
  const current = ++requestId
  loading.value = true
  loadError.value = ''
  try {
    const res = await adminService.users({
      q: debouncedQuery.value,
      role: roleFilter.value === 'ALL' ? undefined : roleFilter.value,
    })
    if (current === requestId) users.value = res
  } catch (e) {
    if (current === requestId) {
      loadError.value = e instanceof ApiError ? e.message : 'No se pudo cargar la lista de usuarios.'
    }
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch([debouncedQuery, roleFilter], loadUsers)
onMounted(() => {
  void loadStats()
  void loadUsers()
})

// --- Acciones ---
const busyId = ref<string | null>(null)
const actionError = ref('')
const pendingDelete = ref<AdminUser | null>(null)

const isMe = (u: AdminUser) => u.id === auth.user?.id

async function toggleRole(u: AdminUser) {
  const next: Role = u.role === 'ADMIN' ? 'USER' : 'ADMIN'
  busyId.value = u.id
  actionError.value = ''
  try {
    const updated = await adminService.setRole(u.id, next)
    // Si el filtro ya no lo incluye, sale de la lista.
    users.value =
      roleFilter.value !== 'ALL' && roleFilter.value !== updated.role
        ? users.value.filter((x) => x.id !== u.id)
        : users.value.map((x) => (x.id === u.id ? updated : x))
    void loadStats()
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : 'No se pudo cambiar el rol.'
  } finally {
    busyId.value = null
  }
}

async function confirmDelete() {
  const u = pendingDelete.value
  if (!u) return
  pendingDelete.value = null
  busyId.value = u.id
  actionError.value = ''
  try {
    await adminService.deleteUser(u.id)
    users.value = users.value.filter((x) => x.id !== u.id)
    void loadStats()
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : 'No se pudo eliminar la cuenta.'
  } finally {
    busyId.value = null
  }
}

const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })
const joined = (iso: string) => dateFmt.format(new Date(iso))
</script>

<template>
  <div class="admin">
    <header>
      <h1 class="admin__title">Administración</h1>
      <p class="admin__subtitle">Gestiona las cuentas de Mosaic y quién tiene permisos de administrador.</p>
    </header>

    <section v-if="statCards.length" class="admin__stats" aria-label="Números generales">
      <StatCard v-for="s in statCards" :key="s.label" :icon="s.icon" :value="s.value" :label="s.label" />
    </section>

    <section class="admin__section">
      <h2 class="admin__section-title"><BaseIcon name="people" /> Usuarios</h2>

      <div class="admin__toolbar">
        <div class="admin__search">
          <BaseIcon name="search" class="admin__search-icon" />
          <input
            v-model="query"
            type="text"
            class="app-input admin__input"
            placeholder="Busca por nombre, correo o @usuario"
            aria-label="Buscar usuarios"
            autocomplete="off"
          />
        </div>
        <div class="admin__tabs" role="tablist" aria-label="Filtrar por rol">
          <button
            v-for="t in ROLE_TABS"
            :key="t.value"
            type="button"
            role="tab"
            class="admin__tab"
            :class="{ 'is-active': roleFilter === t.value }"
            :aria-selected="roleFilter === t.value"
            @click="roleFilter = t.value"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <p v-if="actionError" class="admin__error" role="alert">{{ actionError }}</p>

      <p v-if="loading || isSearching" class="admin__hint"><BaseSpinner size="sm" /> Cargando…</p>
      <EmptyState
        v-else-if="loadError"
        compact
        icon="exclamation-triangle"
        title="No se pudo cargar"
        :text="loadError"
      >
        <BaseButton variant="outline" @click="loadUsers">Reintentar</BaseButton>
      </EmptyState>
      <EmptyState
        v-else-if="!users.length"
        compact
        icon="person-x"
        title="Nadie coincide"
        text="Prueba con otro nombre o cambia el filtro."
      />

      <ul v-else class="admin__list">
        <li v-for="u in users" :key="u.id" class="admin__row">
          <img v-if="u.avatar" :src="u.avatar" alt="" class="admin__avatar" />
          <span v-else class="admin__avatar admin__avatar--placeholder" aria-hidden="true">
            {{ u.name.charAt(0).toUpperCase() }}
          </span>

          <div class="admin__info">
            <p class="admin__name">
              <RouterLink :to="isMe(u) ? '/profile' : `/users/${u.id}`" class="admin__name-link">{{ u.name }}</RouterLink>
              <span v-if="isMe(u)" class="admin__me">Tú</span>
              <span class="admin__role" :class="`admin__role--${u.role.toLowerCase()}`">
                <BaseIcon v-if="u.role === 'ADMIN'" name="shield-lock" />
                {{ u.role === 'ADMIN' ? 'Admin' : 'Usuario' }}
              </span>
            </p>
            <p class="admin__meta">
              {{ u.email }}<template v-if="u.handle"> · @{{ u.handle }}</template>
            </p>
            <p class="admin__meta">
              Desde {{ joined(u.createdAt) }} · {{ u.entries }} {{ u.entries === 1 ? 'obra' : 'obras' }} ·
              {{ u.lists }} {{ u.lists === 1 ? 'lista' : 'listas' }}
            </p>
          </div>

          <div class="admin__actions">
            <BaseSpinner v-if="busyId === u.id" size="sm" />
            <template v-else-if="!isMe(u)">
              <BaseButton variant="outline" :disabled="busyId !== null" @click="toggleRole(u)">
                {{ u.role === 'ADMIN' ? 'Quitar admin' : 'Hacer admin' }}
              </BaseButton>
              <button
                type="button"
                class="admin__delete"
                :disabled="busyId !== null"
                :aria-label="`Eliminar la cuenta de ${u.name}`"
                title="Eliminar cuenta"
                @click="pendingDelete = u"
              >
                <BaseIcon name="trash" />
              </button>
            </template>
          </div>
        </li>
      </ul>
    </section>

    <ConfirmDialog
      v-if="pendingDelete"
      title="Eliminar cuenta"
      :message="`¿Eliminar la cuenta de ${pendingDelete.name} (${pendingDelete.email})? Se borran también sus obras, listas, diario y reseñas. Esta acción no se puede deshacer.`"
      confirm-text="Eliminar cuenta"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </div>
</template>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 960px;
}

.admin__title {
  margin: 0;
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-text);
}

.admin__subtitle {
  margin: var(--space-xs) 0 0;
  color: var(--color-text-muted);
}

.admin__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
}

.admin__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.admin__section-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.admin__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
}

.admin__search {
  position: relative;
  flex: 1 1 260px;
}

.admin__search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.admin__input {
  padding-left: 40px;
}

.admin__tabs {
  display: flex;
  gap: var(--space-xs);
  border-bottom: 1px solid var(--color-border);
}

.admin__tab {
  margin-bottom: -1px;
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.admin__tab:hover {
  color: var(--color-text);
}

.admin__tab.is-active {
  border-bottom-color: var(--color-accent);
  color: var(--color-text);
}

.admin__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  color: var(--color-text-muted);
}

.admin__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.875rem;
}

.admin__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.admin__row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.admin__avatar {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
}

.admin__avatar--placeholder {
  display: grid;
  place-items: center;
  background: var(--color-surface-2);
  color: var(--color-text);
  font-weight: 700;
}

.admin__info {
  flex: 1;
  min-width: 0;
}

.admin__name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-weight: 700;
}

.admin__name-link {
  color: var(--color-text);
  text-decoration: none;
}

.admin__name-link:hover {
  color: var(--color-link-hover);
}

.admin__me {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.admin__role {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.admin__role--admin {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.admin__role--user {
  background: var(--color-surface-2);
  color: var(--color-text-muted);
}

.admin__meta {
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-sm);
}

.admin__delete {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}

.admin__delete:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.admin__delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .admin__stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .admin__row {
    flex-wrap: wrap;
  }

  .admin__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>