<script setup lang="ts">
/**
 * SuggestionCard — una persona sugerida en Personas, mostrando *por qué*:
 * su afinidad contigo (anillo con el %) y las portadas de las obras que
 * tienen en común. Sin nada en común (las cuentas más activas), lo dice.
 *
 * Uso:
 *   <SuggestionCard :person="p" />
 */
import { computed } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import UserAvatar from './UserAvatar.vue'
import FollowButton from './FollowButton.vue'
import { coverOk, vCover } from '../../lib/cover'
import { typeMeta } from '../../lib/catalog'
import type { SuggestedPerson } from '../../types/social'

const props = defineProps<{ person: SuggestedPerson }>()

/** "3 obras en común" o, sin coincidencias, por qué aparece igual. */
const reason = computed(() => {
  const n = props.person.shared
  if (!n) return 'Registra mucho en Mosaic'
  return `${n} ${n === 1 ? 'obra' : 'obras'} en común`
})
</script>

<template>
  <article class="suggestion">
    <header class="suggestion__head">
      <UserAvatar :user="person" :size="48" />
      <div class="suggestion__who">
        <RouterLink :to="`/users/${person.id}`" class="suggestion__name">{{ person.name }}</RouterLink>
        <span v-if="person.handle" class="suggestion__handle">@{{ person.handle }}</span>
      </div>

      <!-- Afinidad: anillo que se llena hasta el % -->
      <span
        v-if="person.affinity != null"
        class="suggestion__affinity"
        :style="{ '--pct': person.affinity }"
        :title="`${person.affinity}% de afinidad: qué parte de sus colecciones coincide`"
      >
        <strong>{{ person.affinity }}%</strong>
      </span>
    </header>

    <p class="suggestion__reason">
      <BaseIcon :name="person.shared ? 'stars' : 'fire'" /> {{ reason }}
    </p>

    <!-- Las obras en común, en miniatura -->
    <ul v-if="person.sharedWorks.length" class="suggestion__works">
      <li v-for="w in person.sharedWorks" :key="w.title" :title="w.title">
        <img v-if="coverOk(w.cover)" v-cover="w.cover" :src="w.cover" alt="" loading="lazy" />
        <span v-else class="suggestion__work-empty" aria-hidden="true"><BaseIcon :name="typeMeta(w.type).icon" /></span>
        <span class="visually-hidden">{{ w.title }}</span>
      </li>
    </ul>

    <FollowButton
      v-if="!person.isSelf"
      class="suggestion__follow"
      :user-id="person.id"
      :following="person.isFollowing"
      :requested="person.requested"
      size="sm"
    />
  </article>
</template>

<style scoped>
.suggestion {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  transition: border-color var(--dur-fast) ease, transform var(--dur-fast) var(--ease-out);
}

.suggestion:hover {
  border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-border));
  transform: translateY(-2px);
}

.suggestion__head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.suggestion__who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.suggestion__name {
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion__name:hover {
  color: var(--color-accent);
}

.suggestion__handle {
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
}

/* Anillo de afinidad: un conic-gradient lleno hasta --pct. */
.suggestion__affinity {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background:
    radial-gradient(closest-side, var(--color-surface) 76%, transparent 78%),
    conic-gradient(var(--color-accent) calc(var(--pct) * 1%), var(--color-surface-2) 0);
}

.suggestion__affinity strong {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--color-accent);
}

.suggestion__reason {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.suggestion__reason .bi {
  color: var(--color-accent);
}

.suggestion__works {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.suggestion__works li {
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
}

.suggestion__works img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.suggestion__work-empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--color-text-subtle);
}

.suggestion__follow {
  align-self: stretch;
  margin-top: auto;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
