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
import { useToastStore } from '../../stores/toast'
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
    // Queda como estaba, y se avisa por qué no cambió.
    useToastStore().error(active.value ? 'No se pudo dejar de seguir. Inténtalo de nuevo.' : 'No se pudo seguir a esta persona. Inténtalo de nuevo.')
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
    <!-- Al cambiar de estado, el texto sale y entra el nuevo (con pop en su ícono). -->
    <Transition name="follow-swap" mode="out-in">
      <span :key="state" class="follow-btn__content">
        <template v-if="state === 'following'">
          <span class="follow-btn__on"><BaseIcon name="check2" /> Siguiendo</span>
          <span class="follow-btn__off"><BaseIcon name="x-lg" /> Dejar de seguir</span>
        </template>
        <template v-else-if="state === 'requested'">
          <span class="follow-btn__on"><BaseIcon name="hourglass-split" /> Solicitud enviada</span>
          <span class="follow-btn__off"><BaseIcon name="x-lg" /> Cancelar solicitud</span>
        </template>
        <template v-else><BaseIcon name="person-plus" /> Seguir</template>
      </span>
    </Transition>
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
  transition:
    background var(--dur-base) ease,
    color var(--dur-base) ease,
    border-color var(--dur-base) ease,
    transform var(--dur-fast) ease;
}

.follow-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.follow-btn__content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.follow-swap-enter-active,
.follow-swap-leave-active {
  transition: opacity var(--dur-fast) ease, transform var(--dur-fast) var(--ease-out);
}

.follow-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.follow-swap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.follow-swap-enter-active .follow-btn__on .bi {
  display: inline-block; /* transform no aplica a elementos inline */
  animation: mosaic-pop var(--dur-base) var(--ease-spring) var(--dur-fast) both;
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
