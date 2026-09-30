<script setup lang="ts">
/**
 * FollowButton — "Seguir" / "Siguiendo". Al pasar el mouse sobre
 * "Siguiendo" ofrece "Dejar de seguir". Cambia al instante y se revierte si
 * falla el guardado. Emite el nuevo estado y el número de seguidores.
 *
 * Uso:
 *   <FollowButton :user-id="id" :following="sigue" @change="(sigue, seguidores) => …" />
 */
import { ref, watch } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import { socialService } from '../../services/socialService'

const props = withDefaults(defineProps<{ userId: string; following: boolean; size?: 'sm' | 'md' }>(), { size: 'md' })
const emit = defineEmits<{ change: [following: boolean, followers: number] }>()

const state = ref(props.following)
watch(
  () => props.following,
  (v) => (state.value = v),
)
const busy = ref(false)

async function toggle() {
  if (busy.value) return
  busy.value = true
  const next = !state.value
  state.value = next
  try {
    const res = next ? await socialService.follow(props.userId) : await socialService.unfollow(props.userId)
    emit('change', next, res.followers)
  } catch {
    state.value = !next
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="follow-btn"
    :class="[`follow-btn--${size}`, { 'is-following': state }]"
    :aria-pressed="state"
    :disabled="busy"
    @click.stop.prevent="toggle"
  >
    <template v-if="state">
      <span class="follow-btn__on"><BaseIcon name="check2" /> Siguiendo</span>
      <span class="follow-btn__off"><BaseIcon name="x-lg" /> Dejar de seguir</span>
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
