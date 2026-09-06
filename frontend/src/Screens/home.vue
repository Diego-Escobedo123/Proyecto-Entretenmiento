<script setup lang="ts">
/**
 * Inicio — panel de entrada: resumen de la colección, obras recientes y
 * filtro rápido por género. Todo sale del store; nada hardcodeado.
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import SectionHeader from '../components/SectionHeader.vue'
import StatCard from '../components/StatCard.vue'
import MediaCard from '../components/MediaCard.vue'
import BaseTag from '../components/BaseTag.vue'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { MEDIA_TYPES } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'
import type { MediaEntry } from '../types/media'

const media = useMediaStore()
const ui = useUiStore()
const { entries, loading, isEmpty, countByType, allGenres, favorites, completedCount } =
  storeToRefs(media)

const activeGenre = ref<string | null>(null)

const recent = computed(() => {
  const base = [...entries.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const filtered = activeGenre.value
    ? base.filter((e) => e.genres.includes(activeGenre.value as string))
    : base
  return filtered.slice(0, 10)
})

const summaryCards = computed(() => [
  ...MEDIA_TYPES.map((t) => ({
    icon: t.icon,
    value: countByType.value[t.value],
    label: t.plural.toLowerCase(),
  })),
])

const pendingDelete = ref<MediaEntry | null>(null)

async function confirmDelete() {
  if (!pendingDelete.value) return
  await media.deleteEntry(pendingDelete.value.id)
  pendingDelete.value = null
}
</script>

<template>
  <template v-if="loading && !media.loaded">
    <p class="home__loading">Cargando tu colección…</p>
  </template>

  <EmptyState
    v-else-if="isEmpty"
    icon="collection-play"
    title="Aún no has registrado ninguna obra"
    text="Empieza a construir tu perfil cultural: agrega la última película, libro, juego o álbum que disfrutaste."
  >
    <BaseButton @click="ui.openCreateEntry()">Agregar mi primera obra</BaseButton>
  </EmptyState>

  <template v-else>
    <section>
      <SectionHeader title="Tu colección en números" />
      <div class="home__stats">
        <StatCard
          v-for="card in summaryCards"
          :key="card.label"
          :icon="card.icon"
          :value="card.value"
          :label="card.label"
        />
        <StatCard icon="star-fill" :value="favorites.length" label="marcadas como favoritas" />
        <StatCard icon="check-circle-fill" :value="completedCount" label="completadas" />
      </div>
    </section>

    <section>
      <SectionHeader title="Actividad reciente" />
      <div v-if="allGenres.length" class="home__genres">
        <BaseTag :active="activeGenre === null" @click="activeGenre = null">Todos</BaseTag>
        <BaseTag
          v-for="genre in allGenres"
          :key="genre"
          :active="activeGenre === genre"
          @click="activeGenre = activeGenre === genre ? null : genre"
        >
          {{ genre }}
        </BaseTag>
      </div>

      <div v-if="recent.length" class="home__grid">
        <MediaCard
          v-for="entry in recent"
          :key="entry.id"
          :entry="entry"
          @toggle-favorite="media.toggleFavorite(entry.id)"
          @edit="ui.openEditEntry(entry.id)"
          @delete="pendingDelete = entry"
        />
      </div>
      <EmptyState
        v-else
        compact
        title="Sin obras en este género"
        text="Prueba con otro filtro o limpia la selección."
      />
    </section>
  </template>

  <ConfirmDialog
    v-if="pendingDelete"
    title="Eliminar obra"
    :message="`¿Eliminar “${pendingDelete.title}”? Esta acción no se puede deshacer.`"
    @confirm="confirmDelete"
    @cancel="pendingDelete = null"
  />
</template>

<style scoped>
.home__loading {
  color: var(--color-text-muted);
}

.home__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
}

.home__genres {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.home__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
}
</style>
