<script setup lang="ts">
/**
 * FollowRequestRow — una solicitud para seguirme (cuenta privada): avatar,
 * nombre y "Confirmar" / "Eliminar", como en Instagram. Al confirmar, esa
 * persona pasa a verme (el store la deja en `accepted` para seguirla de vuelta).
 *
 * Uso:
 *   <FollowRequestRow :person="p" />
 */
import { ref } from 'vue'
import BaseButton from '../BaseButton.vue'
import UserAvatar from './UserAvatar.vue'
import { useFollowRequestsStore } from '../../stores/followRequests'
import { relativeTime } from '../../lib/dates'
import type { FollowRequestPerson } from '../../types/social'

const props = defineProps<{ person: FollowRequestPerson }>()

const requests = useFollowRequestsStore()
const busy = ref(false)
const failed = ref(false)

async function run(action: 'accept' | 'reject') {
  if (busy.value) return
  busy.value = true
  failed.value = false
  try {
    await requests[action](props.person.id)
  } catch {
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="request-row">
    <UserAvatar :user="person" :size="44" />
    <div class="request-row__text">
      <RouterLink :to="`/users/${person.id}`" class="request-row__name">{{ person.name }}</RouterLink>
      <span class="request-row__meta">
        <template v-if="person.handle">@{{ person.handle }} · </template>quiere seguirte · {{ relativeTime(person.requestedAt) }}
      </span>
      <span v-if="failed" class="request-row__error">No se pudo guardar. Intenta de nuevo.</span>
    </div>
    <div class="request-row__actions">
      <BaseButton :disabled="busy" @click="run('accept')">Confirmar</BaseButton>
      <BaseButton variant="outline" :disabled="busy" @click="run('reject')">Eliminar</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.request-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
}

.request-row__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.request-row__name {
  font-weight: 700;
  color: var(--color-text);
}

.request-row__name:hover {
  color: var(--color-accent);
}

.request-row__meta,
.request-row__error {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.request-row__error {
  color: var(--color-danger);
}

.request-row__actions {
  display: flex;
  gap: var(--space-xs);
  flex-shrink: 0;
}

/* Botones compactos, del tamaño del de seguir. */
.request-row__actions :deep(.base-button) {
  padding: 6px 14px;
  font-size: 0.8125rem;
}
</style>
