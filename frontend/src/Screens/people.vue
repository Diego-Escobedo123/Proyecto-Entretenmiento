<script setup lang="ts">
/**
 * Personas — encontrar gente para seguir: buscador por nombre o @usuario y
 * sugerencias según las obras que tienen en común contigo. Arriba, las
 * solicitudes para seguirme (cuenta privada): confirmar o eliminar.
 */
import { computed, onMounted, ref, watch } from 'vue'
import BaseIcon from '../components/BaseIcon.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import PersonRow from '../components/social/PersonRow.vue'
import FollowRequestRow from '../components/social/FollowRequestRow.vue'
import { useFollowRequestsStore } from '../stores/followRequests'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'
import { socialService } from '../services/socialService'
import type { Person, SuggestedPerson } from '../types/social'

const query = ref('')
const { debouncedQuery, isSearching } = useDebouncedSearch(query, 300)
const results = ref<Person[]>([])
const searching = ref(false)
let requestId = 0

watch(debouncedQuery, async (q) => {
  const text = q.trim()
  results.value = []
  if (text.length < 2) return
  const current = ++requestId
  searching.value = true
  try {
    const res = await socialService.searchPeople(text)
    if (current === requestId) results.value = res
  } finally {
    if (current === requestId) searching.value = false
  }
})

const hasQuery = computed(() => debouncedQuery.value.trim().length >= 2)

// --- Solicitudes para seguirme ---
const requests = useFollowRequestsStore()
onMounted(() => void requests.load())

const suggestions = ref<SuggestedPerson[]>([])
const loadingSuggestions = ref(true)
onMounted(async () => {
  try {
    suggestions.value = await socialService.suggestions()
  } finally {
    loadingSuggestions.value = false
  }
})

function sharedDetail(p: SuggestedPerson): string | undefined {
  if (!p.shared) return undefined
  const titles = p.sharedTitles.join(', ')
  return `${p.shared} ${p.shared === 1 ? 'obra' : 'obras'} en común${titles ? `: ${titles}` : ''}`
}
</script>

<template>
  <div class="people">
    <header>
      <h1 class="people__title">Personas</h1>
      <p class="people__subtitle">Sigue a otras personas para ver en Inicio lo que ven, leen, juegan y escuchan.</p>
    </header>

    <div class="people__search">
      <BaseIcon name="search" class="people__search-icon" />
      <input
        v-model="query"
        type="text"
        class="app-input people__input"
        placeholder="Busca por nombre o @usuario"
        aria-label="Buscar personas"
        autocomplete="off"
      />
    </div>

    <section v-if="requests.count || requests.accepted.length" class="people__section">
      <h2 class="people__section-title">
        <BaseIcon name="person-plus" /> Solicitudes
        <span v-if="requests.count" class="people__count">{{ requests.count }}</span>
      </h2>
      <div class="people__list">
        <FollowRequestRow v-for="p in requests.items" :key="p.id" :person="p" />
        <!-- Aceptadas en esta sesión: para seguirlas de vuelta. -->
        <PersonRow v-for="p in requests.accepted" :key="`ok-${p.id}`" :person="p" detail="Ahora te sigue." />
      </div>
    </section>

    <section v-if="hasQuery || isSearching" class="people__section">
      <h2 class="people__section-title">Resultados</h2>
      <p v-if="isSearching || searching" class="people__hint"><BaseSpinner size="sm" /> Buscando…</p>
      <p v-else-if="!results.length" class="people__hint">Nadie coincide con “{{ debouncedQuery.trim() }}”.</p>
      <div v-else class="people__list">
        <PersonRow v-for="p in results" :key="p.id" :person="p" />
      </div>
    </section>

    <section class="people__section">
      <h2 class="people__section-title"><BaseIcon name="stars" /> Gustos parecidos a los tuyos</h2>
      <p v-if="loadingSuggestions" class="people__hint"><BaseSpinner size="sm" /> Buscando personas…</p>
      <EmptyState
        v-else-if="!suggestions.length"
        compact
        icon="people"
        title="Todavía no hay sugerencias"
        text="Cuando más gente con perfil público registre obras, aparecerán aquí las que tengan gustos parecidos a los tuyos."
      />
      <div v-else class="people__list">
        <PersonRow v-for="p in suggestions" :key="p.id" :person="p" :detail="sharedDetail(p)" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.people {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 720px;
}

.people__title {
  margin: 0;
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-text);
}

.people__subtitle {
  margin: var(--space-xs) 0 0;
  color: var(--color-text-muted);
}

.people__search {
  position: relative;
}

.people__search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.people__input {
  padding-left: 40px;
}

.people__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.people__section-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
}

.people__count {
  min-width: 22px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-size: 0.8125rem;
  font-weight: 800;
  text-align: center;
}

.people__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  color: var(--color-text-muted);
}

.people__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
</style>
