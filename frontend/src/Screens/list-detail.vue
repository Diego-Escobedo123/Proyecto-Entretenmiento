<script setup lang="ts">
/**
 * Detalle de una lista (/lists/:id). Su dueño la edita aquí: agrega obras
 * (de su colección o de los catálogos), las reordena, les pone una nota y
 * cambia nombre/descripción/visibilidad. Si es pública, cualquiera con el
 * enlace la ve en modo lectura.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseIcon from '../components/BaseIcon.vue'
import BaseBadge from '../components/BaseBadge.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseSpinner from '../components/BaseSpinner.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import ListAddSearch from '../components/lists/ListAddSearch.vue'
import ListFormModal from '../components/lists/ListFormModal.vue'
import { typeMeta } from '../lib/catalog'
import { ApiError } from '../lib/api'
import { listService } from '../services/listService'
import { useUiStore } from '../stores/ui'
import type { ListDetail, ListItem, ListSummary, ListWork } from '../types/list'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const list = ref<ListDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load(id: string) {
  loading.value = true
  error.value = null
  try {
    list.value = await listService.get(id)
  } catch (e) {
    list.value = null
    error.value =
      e instanceof ApiError && e.status === 404
        ? 'Esta lista no existe o es privada.'
        : 'No se pudo cargar la lista.'
  } finally {
    loading.value = false
  }
}

watch(
  () => String(route.params.id ?? ''),
  (id) => {
    if (id) void load(id)
  },
  { immediate: true },
)

const items = computed(() => list.value?.items ?? [])
/** Portadas externas que ya no cargan: se muestra el ícono del tipo. */
const brokenCovers = ref(new Set<string>())
const workKey = (w: Pick<ListWork, 'type' | 'title' | 'externalId'>) =>
  `${w.type}|${w.externalId ?? w.title.trim().toLowerCase()}`
const keys = computed(() => new Set(items.value.map(workKey)))
const has = (w: ListWork) => keys.value.has(workKey(w))

function open(item: ListItem) {
  ui.openWorkDetail({
    type: item.type,
    title: item.title,
    creator: item.creator,
    year: item.year,
    genres: item.genres,
    cover: item.cover,
    externalId: item.externalId,
  })
}

// --- Edición (sólo el dueño) ---

const adding = ref(false)
const actionError = ref('')

async function add(work: ListWork) {
  if (!list.value) return
  actionError.value = ''
  try {
    const item = await listService.addItem(list.value.id, work)
    list.value.items.push(item)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'No se pudo agregar la obra.'
  }
}

async function remove(item: ListItem) {
  if (!list.value) return
  await listService.removeItem(list.value.id, item.id)
  list.value.items = list.value.items.filter((i) => i.id !== item.id)
}

/** Mueve una obra un lugar arriba (-1) o abajo (+1) y guarda el orden completo. */
async function move(index: number, delta: -1 | 1) {
  if (!list.value) return
  const target = index + delta
  const arr = [...list.value.items]
  if (target < 0 || target >= arr.length) return
  ;[arr[index], arr[target]] = [arr[target], arr[index]]
  const previous = list.value.items
  list.value.items = arr
  try {
    await listService.reorder(list.value.id, arr.map((i) => i.id))
  } catch {
    list.value.items = previous
  }
}

// Nota por obra
const editingNoteId = ref<string | null>(null)
const noteDraft = ref('')

function startNote(item: ListItem) {
  editingNoteId.value = item.id
  noteDraft.value = item.note
}

async function saveNote(item: ListItem) {
  if (!list.value) return
  const updated = await listService.updateNote(list.value.id, item.id, noteDraft.value)
  item.note = updated.note
  editingNoteId.value = null
}

// Datos de la lista
const editingList = ref(false)
function onListSaved(summary: ListSummary) {
  if (!list.value) return
  Object.assign(list.value, {
    title: summary.title,
    description: summary.description,
    isPublic: summary.isPublic,
    ranked: summary.ranked,
  })
}

const confirmingDelete = ref(false)
async function deleteList() {
  if (!list.value) return
  await listService.remove(list.value.id)
  void router.push('/lists')
}

// Compartir
const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* sin permiso de portapapeles: el enlace sigue en la barra de direcciones */
  }
}
</script>

<template>
  <div class="list-detail">
    <RouterLink v-if="list?.isOwner" to="/lists" class="list-detail__back">
      <BaseIcon name="arrow-left" /> Tus listas
    </RouterLink>

    <div v-if="loading && !list" class="list-detail__hint"><BaseSpinner size="sm" /> Cargando lista…</div>
    <EmptyState v-else-if="error" icon="card-list" :title="error" />

    <template v-else-if="list">
      <header class="list-detail__head">
        <div class="list-detail__heading">
          <h1 class="list-detail__title">{{ list.title }}</h1>
          <p class="list-detail__byline">
            <template v-if="!list.isOwner">
              Lista de
              <RouterLink :to="`/users/${list.owner.id}`" class="list-detail__owner">{{ list.owner.name }}</RouterLink>
              ·
            </template>
            {{ items.length }} {{ items.length === 1 ? 'obra' : 'obras' }}
          </p>
          <div class="list-detail__badges">
            <BaseBadge :variant="list.isPublic ? 'accent' : 'default'">
              <BaseIcon :name="list.isPublic ? 'globe' : 'lock-fill'" /> {{ list.isPublic ? 'Pública' : 'Privada' }}
            </BaseBadge>
            <BaseBadge v-if="list.ranked"><BaseIcon name="sort-numeric-down" /> Ranking</BaseBadge>
          </div>
        </div>

        <div class="list-detail__actions">
          <BaseButton v-if="list.isPublic" variant="outline" @click="copyLink">
            <BaseIcon :name="copied ? 'check2' : 'link-45deg'" /> {{ copied ? 'Enlace copiado' : 'Copiar enlace' }}
          </BaseButton>
          <template v-if="list.isOwner">
            <BaseButton variant="outline" @click="editingList = true"><BaseIcon name="pencil" /> Editar</BaseButton>
            <BaseButton variant="ghost" aria-label="Eliminar lista" @click="confirmingDelete = true">
              <BaseIcon name="trash" />
            </BaseButton>
          </template>
        </div>
      </header>

      <p v-if="list.description" class="list-detail__description">{{ list.description }}</p>

      <template v-if="list.isOwner">
        <BaseButton v-if="!adding" class="list-detail__add-toggle" @click="adding = true">+ Agregar obras</BaseButton>
        <div v-else class="list-detail__add">
          <ListAddSearch :has="has" @add="add" />
          <p v-if="actionError" class="list-detail__error">{{ actionError }}</p>
          <button type="button" class="list-detail__add-close" @click="adding = false">Listo</button>
        </div>
      </template>

      <EmptyState
        v-if="!items.length"
        compact
        icon="collection"
        title="La lista está vacía"
        :text="list.isOwner ? 'Agrega obras con el buscador de arriba o desde la ficha de cualquier obra.' : undefined"
      />

      <ol v-else class="list-detail__items">
        <li v-for="(item, i) in items" :key="item.id" class="list-detail__item">
          <span v-if="list.ranked" class="list-detail__rank">{{ i + 1 }}</span>

          <button type="button" class="list-detail__cover-btn" :aria-label="`Ver ficha de ${item.title}`" @click="open(item)">
            <img
              v-if="item.cover && !brokenCovers.has(item.id)"
              :src="item.cover"
              alt=""
              class="list-detail__cover"
              loading="lazy"
              @error="brokenCovers.add(item.id)"
            />
            <span v-else class="list-detail__cover list-detail__cover--empty" aria-hidden="true">
              <BaseIcon :name="typeMeta(item.type).icon" />
            </span>
          </button>

          <div class="list-detail__body">
            <button type="button" class="list-detail__work" @click="open(item)">{{ item.title }}</button>
            <p class="list-detail__meta">
              <BaseIcon :name="typeMeta(item.type).icon" />
              {{ [typeMeta(item.type).label, item.creator, item.year].filter(Boolean).join(' · ') }}
            </p>

            <form v-if="editingNoteId === item.id" class="list-detail__note-form" @submit.prevent="saveNote(item)">
              <textarea
                v-model="noteDraft"
                class="app-textarea list-detail__note-input"
                maxlength="500"
                placeholder="¿Por qué está en la lista?"
                aria-label="Nota sobre la obra"
              />
              <div class="list-detail__note-actions">
                <BaseButton variant="ghost" @click="editingNoteId = null">Cancelar</BaseButton>
                <BaseButton type="submit">Guardar nota</BaseButton>
              </div>
            </form>
            <p v-else-if="item.note" class="list-detail__note">{{ item.note }}</p>
            <button
              v-if="list.isOwner && editingNoteId !== item.id"
              type="button"
              class="list-detail__note-link"
              @click="startNote(item)"
            >
              {{ item.note ? 'Editar nota' : '+ Agregar nota' }}
            </button>
          </div>

          <div v-if="list.isOwner" class="list-detail__controls">
            <button type="button" class="list-detail__icon" :disabled="i === 0" aria-label="Subir" title="Subir" @click="move(i, -1)">
              <BaseIcon name="chevron-up" />
            </button>
            <button
              type="button"
              class="list-detail__icon"
              :disabled="i === items.length - 1"
              aria-label="Bajar"
              title="Bajar"
              @click="move(i, 1)"
            >
              <BaseIcon name="chevron-down" />
            </button>
            <button type="button" class="list-detail__icon" aria-label="Quitar de la lista" title="Quitar de la lista" @click="remove(item)">
              <BaseIcon name="x-lg" />
            </button>
          </div>
        </li>
      </ol>

      <ListFormModal v-if="editingList" :list="list" @close="editingList = false" @saved="onListSaved" />
      <ConfirmDialog
        v-if="confirmingDelete"
        title="Eliminar lista"
        :message="`¿Eliminar “${list.title}”? Las obras no se borran de tu colección.`"
        @confirm="deleteList"
        @cancel="confirmingDelete = false"
      />
    </template>
  </div>
</template>

<style scoped>
.list-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 900px;
}

.list-detail__back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.list-detail__back:hover {
  color: var(--color-text);
}

.list-detail__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text-muted);
}

.list-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.list-detail__heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.list-detail__title {
  margin: 0;
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.list-detail__byline {
  margin: 0;
  color: var(--color-text-muted);
}

.list-detail__owner {
  font-weight: 700;
  color: var(--color-text);
}

.list-detail__owner:hover {
  color: var(--color-accent);
}

.list-detail__badges {
  display: flex;
  gap: var(--space-xs);
}

.list-detail__actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.list-detail__description {
  margin: 0;
  line-height: 1.6;
  color: var(--color-text);
  white-space: pre-line;
}

.list-detail__add-toggle {
  align-self: flex-start;
}

.list-detail__add {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.list-detail__add-close {
  align-self: flex-end;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
}

.list-detail__error {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-danger);
}

.list-detail__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.list-detail__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.list-detail__rank {
  width: 2ch;
  flex-shrink: 0;
  align-self: center;
  text-align: right;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}

.list-detail__cover-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.list-detail__cover {
  display: block;
  width: 64px;
  height: 96px;
  border-radius: var(--radius-md);
  object-fit: cover;
  background: var(--color-surface-2);
}

.list-detail__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-subtle);
}

.list-detail__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.list-detail__work {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.list-detail__work:hover {
  color: var(--color-accent);
}

.list-detail__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.list-detail__note {
  margin: 4px 0 0;
  padding-left: var(--space-sm);
  border-left: 2px solid var(--color-accent);
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--color-text);
  white-space: pre-line;
}

.list-detail__note-link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
}

.list-detail__note-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.list-detail__note-input {
  min-height: 64px;
}

.list-detail__note-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.list-detail__controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-detail__icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  cursor: pointer;
}

.list-detail__icon:hover:not(:disabled) {
  color: var(--color-text);
}

.list-detail__icon:disabled {
  opacity: 0.35;
  cursor: default;
}

@media (max-width: 560px) {
  .list-detail__title {
    font-size: 1.75rem;
  }

  .list-detail__cover {
    width: 48px;
    height: 72px;
  }
}
</style>
