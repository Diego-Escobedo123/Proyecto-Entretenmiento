<script setup lang="ts">
/**
 * FollowButton — "Seguir" / "Solicitud enviada" / "Siguiendo", como en
 * Instagram: a una cuenta pública se la sigue directo; a una privada se le
 * manda una solicitud. Al pasar el mouse ofrece "Dejar de seguir" o
 * "Cancelar solicitud". Emite el nuevo estado y el número de seguidores
 * (null si no se puede ver la cuenta).
 *
 * Uso:
 *   <FollowButton :user-id="id" :following="sigue" :requested="pendiente" @change="(estado, seguidores) => …" />
 */
import { computed, ref, watch } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import { socialService } from '../../services/socialService'
import type { FollowStatus } from '../../types/social'

const props = withDefaults(
  defineProps<{ userId: string; following: boolean; requested?: boolean; size?: 'sm' | 'md' }>(),
  { requested: false, size: 'md' },
)
const emit = defineEmits<{ change: [status: FollowStatus, followers: number | null] }>()

const fromProps = (): FollowStatus => (props.following ? 'following' : props.requested ? 'requested' : 'none')
const state = ref<FollowStatus>(fromProps())
watch(() => [props.following, props.requested], () => (state.value = fromProps()))
const busy = ref(false)
/** Siguiendo o con solicitud pendiente: el botón pasa a "deshacer". */
const active = computed(() => state.value !== 'none')

// No es optimista: si seguir termina en solicitud recién se sabe con la respuesta.
async function toggle() {
  if (busy.value) return
  busy.value = true
  try {
    const res = active.value ? await socialService.unfollow(props.userId) : await socialService.follow(props.userId)
    state.value = res.status
    emit('change', res.status, res.followers)
  } catch {
    // Queda como estaba.
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="follow-btn"
    :class="[`follow-btn--${size}`, { 'is-following': active }]"
    :aria-pressed="active"
    :disabled="busy"
    @click.stop.prevent="toggle"
  >
    <template v-if="state === 'following'">
      <span class="follow-btn__on"><BaseIcon name="check2" /> Siguiendo</span>
      <span class="follow-btn__off"><BaseIcon name="x-lg" /> Dejar de seguir</span>
    </template>
    <template v-else-if="state === 'requested'">
      <span class="follow-btn__on"><BaseIcon name="hourglass-split" /> Solicitud enviada</span>
      <span class="follow-btn__off"><BaseIcon name="x-lg" /> Cancelar solicitud</span>
    </template>
    <template v-else><BaseIcon name="person-plus" /> Seguir</template>
  </button>
</template>

<style scoped>
.follow-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  border: 1px solid var(--color-accent);
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.follow-btn--md {
  padding: 8px 16px;
  font-size: 0.875rem;
}

.follow-btn--sm {
  padding: 5px 12px;
  font-size: 0.8125rem;
}

.follow-btn:disabled {
  opacity: 0.7;
  cursor: default;
}

.follow-btn.is-following {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.follow-btn__off {
  display: none;
}

.follow-btn.is-following:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.follow-btn.is-following:hover:not(:disabled) .follow-btn__on {
  display: none;
}

.follow-btn.is-following:hover:not(:disabled) .follow-btn__off {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
