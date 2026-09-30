<script setup lang="ts">
/**
 * WorkDetailModal — ficha de una obra del catálogo externo: sus datos, las
 * reseñas de la comunidad y la acción para agregarla (o editarla, si ya está
 * en la colección). Se controla desde `useUiStore().detailWork`.
 */
import { computed, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import BaseIcon from './BaseIcon.vue'
import CommunityReviews from './CommunityReviews.vue'
import WorkStats from './WorkStats.vue'
import WorkInfo from './WorkInfo.vue'
import AddToList from './lists/AddToList.vue'
import { typeMeta } from '../lib/catalog'
import { useMediaStore } from '../stores/media'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const media = useMediaStore()

const modalRef = ref<InstanceType<typeof BaseModal> | null>(null)
function closeAnimated() {
  modalRef.value?.requestClose()
}

const work = computed(() => ui.detailWork)
const owned = computed(() =>
  work.value ? media.findByTitle(work.value.type, work.value.title, work.value.externalId) : undefined,
)

/**
 * Wishlist = en la colección con estado "Quiero verla/leerlo/…". El botón
 * sólo aparece si la obra no está en la colección o está en la wishlist
 * (una obra ya vista no se "desea"); quitarla la saca de la colección.
 */
const inWishlist = computed(() => owned.value?.status === 'want')
const wishBusy = ref(false)

async function toggleWishlist() {
  if (!work.value || wishBusy.value) return
  wishBusy.value = true
  try {
    if (owned.value) await media.deleteEntry(owned.value.id)
    else await media.addToWishlist(work.value)
  } finally {
    wishBusy.value = false
  }
}

function addOrEdit() {
  if (!work.value) return
  // Cambia el modal activo directamente: el formulario muestra también las reseñas.
  if (owned.value) ui.openEditEntry(owned.value.id)
  else ui.openCreateEntry({ ...work.value })
}
</script>

<template>
  <BaseModal
    v-if="work"
    ref="modalRef"
    :title="typeMeta(work.type).label"
    size="lg"
    @close="ui.closeModal()"
  >
    <div class="work-detail">
      <div class="work-detail__head">
        <img v-if="work.cover" :src="work.cover" alt="" class="work-detail__cover" />
        <div v-else class="work-detail__cover work-detail__cover--empty" aria-hidden="true">
          <BaseIcon :name="typeMeta(work.type).icon" />
        </div>

        <div class="work-detail__info">
          <h2 class="work-detail__title">{{ work.title }}</h2>
          <p v-if="work.creator || work.year" class="work-detail__meta">
            {{ [work.creator, work.year].filter(Boolean).join(' · ') }}
          </p>
          <div v-if="work.genres.length" class="work-detail__genres">
            <span v-for="g in work.genres" :key="g" class="work-detail__genre">{{ g }}</span>
          </div>
          <p v-if="owned && !inWishlist" class="work-detail__owned">
            <BaseIcon name="check-circle-fill" /> Ya está en tu colección
          </p>
        </div>
      </div>

      <div class="work-detail__actions">
        <button
          v-if="!owned || inWishlist"
          type="button"
          class="work-detail__wish"
          :class="{ 'is-on': inWishlist }"
          :aria-pressed="inWishlist"
          :disabled="wishBusy"
          :title="inWishlist ? 'Quitar de tu wishlist' : undefined"
          @click="toggleWishlist"
        >
          <BaseIcon :name="inWishlist ? 'bookmark-heart-fill' : 'bookmark-heart'" />
          {{ inWishlist ? 'En tu wishlist' : 'Agregar a wishlist' }}
        </button>
        <AddToList :work="work" />
      </div>

      <WorkInfo :type="work.type" :external-id="work.externalId" />

      <WorkStats
        :work="{ type: work.type, externalId: work.externalId, title: work.title }"
        @navigate="closeAnimated"
      />

      <CommunityReviews
        :work="{ type: work.type, externalId: work.externalId, title: work.title }"
        hide-average
        @navigate="closeAnimated"
      />
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="closeAnimated">Cerrar</BaseButton>
      <BaseButton @click="addOrEdit">
        {{ owned ? 'Editar mi registro' : '+ Agregar a mi colección' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.work-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.work-detail__head {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
}

.work-detail__cover {
  width: 110px;
  aspect-ratio: 2 / 3;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  object-fit: cover;
  background: var(--color-surface-2);
}

.work-detail__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--color-text-subtle);
}

.work-detail__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.work-detail__title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 800;
  color: var(--color-text);
}

.work-detail__meta {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.work-detail__genres {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.work-detail__genre {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
}

.work-detail__owned {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: var(--space-xs) 0 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-success);
}

.work-detail__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-sm);
}

.work-detail__actions > :last-child {
  flex: 1 1 260px;
}

.work-detail__wish {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-2);
  color: var(--color-text);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.work-detail__wish:hover {
  border-color: var(--color-accent);
}

.work-detail__wish.is-on {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.work-detail__wish:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
