<script setup lang="ts">
/**
 * Personas — encontrar gente para seguir. Buscador por nombre o @usuario
 * (mientras se busca, sólo se ven los resultados). Si no: las solicitudes
 * para seguirme (cuenta privada), las sugerencias como tarjetas con la
 * afinidad y las obras en común, y al final "Tu red" (seguidores / seguidos,
 * con "Te sigue" en quienes te siguen).
 */
import SkeletonList from '../components/SkeletonList.vue'
import SuggestionCard from '../components/social/SuggestionCard.vue'
import { computed, onMounted, ref, watch } from 'vue'
import BaseIcon from '../components/BaseIcon.vue'
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

// --- Tu red: mis seguidores y a quiénes sigo ---
type NetworkTab = 'followers' | 'following'
const networkTab = ref<NetworkTab>('followers')
const network = ref<Record<NetworkTab, Person[]>>({ followers: [], following: [] })
const loadingNetwork = ref(true)
const networkFailed = ref(false)
onMounted(async () => {
  try {
    const [followers, following] = await Promise.all([socialService.followers('me'), socialService.following('me')])
    network.value = { followers, following }
  } catch {
    networkFailed.value = true
  } finally {
    loadingNetwork.value = false
  }
})
const NETWORK_EMPTY: Record<NetworkTab, { title: string; text: string }> = {
  followers: { title: 'Todavía nadie te sigue', text: 'Cuando alguien te siga, aparecerá aquí.' },
  following: { title: 'Todavía no sigues a nadie', text: 'Busca personas arriba o sigue alguna de las sugerencias de abajo.' },
}

const suggestions = ref<SuggestedPerson[]>([])
const loadingSuggestions = ref(true)
onMounted(async () => {
  try {
    suggestions.value = await socialService.suggestions()
  } finally {
    loadingSuggestions.value = false
  }
})

/** Quienes me siguen: para marcar "Te sigue" en la pestaña de seguidos. */
const followerIds = computed(() => new Set(network.value.followers.map((p) => p.id)))
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

    <!-- Buscando: sólo los resultados (lo demás vuelve al borrar el texto) -->
    <section v-if="hasQuery || isSearching" class="people__section">
      <h2 class="people__section-title"><BaseIcon name="search" /> Resultados</h2>
      <SkeletonList v-if="isSearching || searching" :rows="3" avatar />
      <p v-else-if="!results.length" class="people__hint">Nadie coincide con “{{ debouncedQuery.trim() }}”.</p>
      <div v-else class="people__list">
        <PersonRow v-for="p in results" :key="p.id" :person="p" :follows-you="followerIds.has(p.id)" />
      </div>
    </section>

    <template v-else>
      <section v-if="requests.count || requests.accepted.length" class="people__section">
        <h2 class="people__section-title">
          <BaseIcon name="person-plus" /> Solicitudes
          <span v-if="requests.count" class="people__count">{{ requests.count }}</span>
        </h2>
        <div class="people__list">
          <FollowRequestRow v-for="p in requests.items" :key="p.id" :person="p" />
          <!-- Aceptadas en esta sesión: para seguirlas de vuelta. -->
          <PersonRow v-for="p in requests.accepted" :key="`ok-${p.id}`" :person="p" follows-you />
        </div>
      </section>

      <!-- Para descubrir gente: tarjetas que muestran por qué (afinidad y obras en común) -->
      <section class="people__section">
        <h2 class="people__section-title"><BaseIcon name="stars" /> Gustos parecidos a los tuyos</h2>
        <div v-if="loadingSuggestions" class="people__suggestions" aria-busy="true" aria-label="Buscando personas">
          <div v-for="n in 3" :key="n" class="people__suggestion-skeleton mosaic-skeleton" />
        </div>
        <EmptyState
          v-else-if="!suggestions.length"
          compact
          icon="people"
          title="Todavía no hay sugerencias"
          text="Cuando más gente con perfil público registre obras, aparecerán aquí las que tengan gustos parecidos a los tuyos."
        />
        <div v-else class="people__suggestions">
          <SuggestionCard
            v-for="(p, i) in suggestions"
            :key="p.id"
            class="mosaic-enter"
            :style="{ '--i': i }"
            :person="p"
          />
        </div>
      </section>

      <!-- Tu red, al final: también está en tu perfil (seguidores / seguidos) -->
      <section class="people__section">
        <h2 class="people__section-title"><BaseIcon name="people" /> Tu red</h2>
        <div class="people__tabs" role="tablist" aria-label="Seguidores y seguidos">
          <button
            v-for="t in (['followers', 'following'] as const)"
            :key="t"
            type="button"
            role="tab"
            class="people__tab"
            :class="{ 'is-active': networkTab === t }"
            :aria-selected="networkTab === t"
            @click="networkTab = t"
          >
            {{ t === 'followers' ? 'Seguidores' : 'Seguidos' }}
            <span v-if="!loadingNetwork && !networkFailed" class="people__tab-count">{{ network[t].length }}</span>
          </button>
        </div>
        <SkeletonList v-if="loadingNetwork" :rows="4" avatar />
        <p v-else-if="networkFailed" class="people__hint">No se pudo cargar tu red.</p>
        <EmptyState
          v-else-if="!network[networkTab].length"
          compact
          icon="people"
          :title="NETWORK_EMPTY[networkTab].title"
          :text="NETWORK_EMPTY[networkTab].text"
        />
        <!-- En Seguidores todos te siguen; en Seguidos, se marca quién te sigue de vuelta -->
        <div v-else class="people__list" role="tabpanel">
          <PersonRow
            v-for="p in network[networkTab]"
            :key="p.id"
            :person="p"
            :follows-you="networkTab === 'followers' || followerIds.has(p.id)"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.people {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 960px;
}

/* Sugerencias: tarjetas en cuadrícula (2–3 por fila según el ancho). */
.people__suggestions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-md);
}

.people__suggestion-skeleton {
  height: 220px;
  border-radius: var(--radius-lg);
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

/* Pestañas Seguidores | Seguidos, con su cantidad. */
.people__tabs {
  display: flex;
  gap: var(--space-xs);
  border-bottom: 1px solid var(--color-border);
}

.people__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.people__tab:hover {
  color: var(--color-text);
}

.people__tab.is-active {
  border-bottom-color: var(--color-accent);
  color: var(--color-text);
}

.people__tab-count {
  min-width: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--color-surface-2);
  font-size: 0.8125rem;
  text-align: center;
}

.people__tab.is-active .people__tab-count {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
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
