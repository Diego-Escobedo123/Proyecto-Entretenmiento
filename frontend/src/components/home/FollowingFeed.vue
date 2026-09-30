<script setup lang="ts">
/**
 * FollowingFeed — en Inicio, la actividad de quienes sigue el usuario (su
 * diario y sus listas nuevas), con "Ver más" para paginar. Si todavía no
 * sigue a nadie, muestra sugerencias para empezar.
 */
import { onMounted, ref } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import BaseSpinner from '../BaseSpinner.vue'
import SectionHeader from '../SectionHeader.vue'
import FeedItemCard from '../social/FeedItemCard.vue'
import PersonRow from '../social/PersonRow.vue'
import { socialService } from '../../services/socialService'
import type { FeedItem, SuggestedPerson } from '../../types/social'

const items = ref<FeedItem[]>([])
const nextBefore = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const failed = ref(false)

const followsSomeone = ref(true)
const suggestions = ref<SuggestedPerson[]>([])

onMounted(async () => {
  try {
    const [page, me] = await Promise.all([socialService.feed(), socialService.publicProfile('me')])
    items.value = page.items
    nextBefore.value = page.nextBefore
    // El perfil propio siempre trae los contadores (sólo son null en cuentas privadas ajenas).
    followsSomeone.value = (me.following ?? 0) > 0
    if (!page.items.length) suggestions.value = (await socialService.suggestions()).slice(0, 4)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

async function loadMore() {
  if (!nextBefore.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const page = await socialService.feed(nextBefore.value)
    items.value = [...items.value, ...page.items]
    nextBefore.value = page.nextBefore
  } finally {
    loadingMore.value = false
  }
}

const detail = (p: SuggestedPerson) =>
  p.shared ? `${p.shared} ${p.shared === 1 ? 'obra' : 'obras'} en común` : undefined
</script>

<template>
  <section class="feed">
    <div class="feed__head">
      <SectionHeader title="Actividad de quienes sigues" />
      <RouterLink to="/people" class="feed__link"><BaseIcon name="person-plus" /> Buscar personas</RouterLink>
    </div>

    <p v-if="loading" class="feed__hint"><BaseSpinner size="sm" /> Cargando actividad…</p>
    <p v-else-if="failed" class="feed__hint">No se pudo cargar la actividad.</p>

    <template v-else-if="items.length">
      <div class="feed__list">
        <FeedItemCard v-for="item in items" :key="item.id" :item="item" />
      </div>
      <button v-if="nextBefore" type="button" class="feed__more" :disabled="loadingMore" @click="loadMore">
        <BaseSpinner v-if="loadingMore" size="sm" /> Ver más
      </button>
    </template>

    <div v-else class="feed__empty">
      <p class="feed__hint">
        <template v-if="followsSomeone">
          Las personas que sigues no han registrado nada todavía (o tienen el perfil privado).
        </template>
        <template v-else>Sigue a otras personas para ver aquí lo que ven, leen, juegan y escuchan.</template>
      </p>
      <div v-if="suggestions.length" class="feed__suggestions">
        <PersonRow v-for="p in suggestions" :key="p.id" :person="p" :detail="detail(p)" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.feed__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.feed__head :deep(.section-header) {
  margin: 0;
}

.feed__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-accent);
}

.feed__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  color: var(--color-text-muted);
}

.feed__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.feed__more {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 8px 20px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.feed__more:hover:not(:disabled) {
  border-color: var(--color-accent);
}

.feed__empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-lg);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.feed__suggestions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
