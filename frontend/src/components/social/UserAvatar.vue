<script setup lang="ts">
/**
 * UserAvatar — foto de la persona o su inicial. Enlaza a su perfil público
 * salvo que se pase `link: false`.
 *
 * Uso:
 *   <UserAvatar :user="user" :size="40" />
 */
import type { PublicUser } from '../../types/review'

withDefaults(defineProps<{ user: Pick<PublicUser, 'id' | 'name' | 'avatar'>; size?: number; link?: boolean }>(), {
  size: 40,
  link: true,
})
defineEmits<{ navigate: [] }>()
</script>

<template>
  <component
    :is="link ? 'RouterLink' : 'span'"
    :to="link ? `/users/${user.id}` : undefined"
    class="user-avatar"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.42)}px` }"
    :aria-label="link ? `Perfil de ${user.name}` : undefined"
    @click="$emit('navigate')"
  >
    <img v-if="user.avatar" :src="user.avatar" alt="" />
    <span v-else aria-hidden="true">{{ user.name.charAt(0).toUpperCase() }}</span>
  </component>
</template>

<style scoped>
.user-avatar {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 700;
  text-decoration: none;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
