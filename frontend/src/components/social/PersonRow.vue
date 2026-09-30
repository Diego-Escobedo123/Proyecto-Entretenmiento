<script setup lang="ts">
/**
 * PersonRow — una persona en listas (seguidores, búsqueda, sugerencias):
 * avatar, nombre, @usuario, una línea opcional de contexto y el botón de
 * seguir (no aparece para el propio usuario).
 *
 * Uso:
 *   <PersonRow :person="p" detail="3 obras en común: Dune, …" />
 */
import UserAvatar from './UserAvatar.vue'
import FollowButton from './FollowButton.vue'
import type { Person } from '../../types/social'

defineProps<{ person: Person; detail?: string }>()
const emit = defineEmits<{ navigate: [] }>()
</script>

<template>
  <div class="person-row">
    <UserAvatar :user="person" :size="44" @navigate="emit('navigate')" />
    <div class="person-row__text">
      <RouterLink :to="`/users/${person.id}`" class="person-row__name" @click="emit('navigate')">{{ person.name }}</RouterLink>
      <span v-if="person.handle" class="person-row__handle">@{{ person.handle }}</span>
      <span v-if="detail" class="person-row__detail">{{ detail }}</span>
    </div>
    <span v-if="person.isSelf" class="person-row__self">Tú</span>
    <FollowButton v-else :user-id="person.id" :following="person.isFollowing" size="sm" />
  </div>
</template>

<style scoped>
.person-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
}

.person-row:hover {
  background: var(--color-surface-2);
}

.person-row__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.person-row__name {
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.person-row__name:hover {
  color: var(--color-accent);
}

.person-row__handle,
.person-row__detail {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.person-row__self {
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
}
</style>
