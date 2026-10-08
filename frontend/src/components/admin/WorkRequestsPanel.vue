<script setup lang="ts">
/**
 * WorkRequestsPanel — solicitudes de obras que los usuarios escribieron a
 * mano porque no estaban en el catálogo. El admin revisa los datos y la
 * aprueba (la obra se agrega a la colección de quien la pidió) o la rechaza.
 * Emite `reviewed` para que la pantalla actualice sus números.
 */
import { onMounted, ref } from 'vue'
import BaseButton from '../BaseButton.vue'
import BaseIcon from '../BaseIcon.vue'
import BaseSpinner from '../BaseSpinner.vue'
import EmptyState from '../EmptyState.vue'
import { ApiError } from '../../lib/api'
import { typeMeta } from '../../lib/catalog'
import { adminService } from '../../services/adminService'
import type { WorkRequest } from '../../types/admin'

const emit = defineEmits<{ reviewed: [] }>()

const requests = ref<WorkRequest[]>([])
const loading = ref(true)
const loadError = ref('')
const busyId = ref<string | null>(null)
const actionError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    requests.value = await adminService.workRequests()
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudieron cargar las solicitudes.'
  } finally {
    loading.value = false
  }
}

async function review(r: WorkRequest, approve: boolean) {
  busyId.value = r.id
  actionError.value = ''
  try {
    if (approve) await adminService.approveWorkRequest(r.id)
    else await adminService.rejectWorkRequest(r.id)
    requests.value = requests.value.filter((x) => x.id !== r.id)
    emit('reviewed')
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : 'No se pudo revisar la solicitud.'
    // Si otro admin ya la revisó, la lista se pone al día.
    if (e instanceof ApiError && e.status === 409) void load()
  } finally {
    busyId.value = null
  }
}

const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })
const requestedOn = (iso: string) => dateFmt.format(new Date(iso))

onMounted(load)
</script>

<template>
  <section class="requests">
    <h2 class="requests__title">
      <BaseIcon name="inbox" /> Solicitudes de obras
      <span v-if="requests.length" class="requests__count">{{ requests.length }}</span>
    </h2>
    <p class="requests__subtitle">
      Obras que los usuarios escribieron a mano porque no están en el catálogo. Al aprobarlas se agregan a su
      colección.
    </p>

    <p v-if="actionError" class="requests__error" role="alert">{{ actionError }}</p>

    <p v-if="loading" class="requests__hint"><BaseSpinner size="sm" /> Cargando…</p>
    <EmptyState v-else-if="loadError" compact icon="exclamation-triangle" title="No se pudo cargar" :text="loadError">
      <BaseButton variant="outline" @click="load">Reintentar</BaseButton>
    </EmptyState>
    <EmptyState
      v-else-if="!requests.length"
      compact
      icon="inbox"
      title="No hay solicitudes pendientes"
      text="Cuando alguien agregue una obra a mano, aparecerá aquí."
    />

    <ul v-else class="requests__list">
      <li v-for="r in requests" :key="r.id" class="requests__row">
        <span class="requests__type" aria-hidden="true"><BaseIcon :name="typeMeta(r.type).icon" /></span>

        <div class="requests__info">
          <p class="requests__work">
            {{ r.title }}
            <span class="requests__badge">{{ typeMeta(r.type).label }}</span>
          </p>
          <p class="requests__meta">
            {{ [r.creator, r.year].filter(Boolean).join(' · ') || 'Sin autor ni año' }}
            <template v-if="r.genres.length"> · {{ r.genres.join(', ') }}</template>
          </p>
          <p v-if="r.user" class="requests__meta">
            Pedida por
            <RouterLink :to="`/users/${r.user.id}`" class="requests__user">{{ r.user.name }}</RouterLink>
            <template v-if="r.user.handle"> (@{{ r.user.handle }})</template>
            el {{ requestedOn(r.createdAt) }}
          </p>
        </div>

        <div class="requests__actions">
          <BaseSpinner v-if="busyId === r.id" size="sm" />
          <template v-else>
            <BaseButton variant="outline" :disabled="busyId !== null" @click="review(r, false)">Rechazar</BaseButton>
            <BaseButton :disabled="busyId !== null" @click="review(r, true)">Aprobar</BaseButton>
          </template>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.requests {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.requests__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.requests__count {
  min-width: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 22px;
  text-align: center;
}

.requests__subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.requests__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  color: var(--color-text-muted);
}

.requests__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.875rem;
}

.requests__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.requests__row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.requests__type {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-accent);
  font-size: 1.125rem;
}

.requests__info {
  flex: 1;
  min-width: 0;
}

.requests__work {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  color: var(--color-text);
  font-weight: 700;
}

.requests__badge {
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.requests__meta {
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.requests__user {
  color: var(--color-text);
  text-decoration: none;
}

.requests__user:hover {
  color: var(--color-link-hover);
}

.requests__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-sm);
}

@media (max-width: 640px) {
  .requests__row {
    flex-wrap: wrap;
  }

  .requests__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>