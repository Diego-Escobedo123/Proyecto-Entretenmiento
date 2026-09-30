<script setup lang="ts">
/**
 * AddToList — "Agregar a lista" dentro de la ficha de una obra: muestra mis
 * listas con una casilla cada una (marcada si la obra ya está) y permite
 * crear una lista nueva en el momento, con la obra adentro.
 *
 * Uso:
 *   <AddToList :work="work" />
 */
import { computed, ref } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import BaseSpinner from '../BaseSpinner.vue'
import { listService } from '../../services/listService'
import type { ListSummary, ListWork } from '../../types/list'

const props = defineProps<{ work: ListWork }>()

const open = ref(false)
const lists = ref<ListSummary[]>([])
const loading = ref(false)
const failed = ref(false)
/** Listas con una operación en curso (para no hacer doble clic). */
const busy = ref(new Set<string>())

async function toggleOpen() {
  open.value = !open.value
  if (!open.value) return
  loading.value = true
  failed.value = false
  try {
    lists.value = await listService.mine(props.work)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

const savedIn = computed(() => lists.value.filter((l) => l.workItemId).length)

async function toggle(list: ListSummary) {
  if (busy.value.has(list.id)) return
  busy.value.add(list.id)
  try {
    if (list.workItemId) {
      await listService.removeItem(list.id, list.workItemId)
      list.workItemId = null
      list.itemCount--
    } else {
      const item = await listService.addItem(list.id, props.work)
      list.workItemId = item.id
      list.itemCount++
    }
  } finally {
    busy.value.delete(list.id)
  }
}

// --- Lista nueva con esta obra ---
const newTitle = ref('')
const creating = ref(false)

async function createWithWork() {
  const title = newTitle.value.trim()
  if (!title || creating.value) return
  creating.value = true
  try {
    const list = await listService.create({ title })
    const item = await listService.addItem(list.id, props.work)
    lists.value = [{ ...list, itemCount: 1, workItemId: item.id }, ...lists.value]
    newTitle.value = ''
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <section class="add-to-list">
    <button type="button" class="add-to-list__toggle" :aria-expanded="open" @click="toggleOpen">
      <BaseIcon name="card-list" />
      Agregar a lista
      <span v-if="open && savedIn" class="add-to-list__count">· en {{ savedIn }}</span>
      <BaseIcon :name="open ? 'chevron-up' : 'chevron-down'" class="add-to-list__chevron" />
    </button>

    <div v-if="open" class="add-to-list__panel">
      <p v-if="loading" class="add-to-list__hint"><BaseSpinner size="sm" /> Cargando tus listas…</p>
      <p v-else-if="failed" class="add-to-list__hint">No se pudieron cargar tus listas.</p>

      <template v-else>
        <p v-if="!lists.length" class="add-to-list__hint">Aún no tienes listas. Crea la primera:</p>
        <ul v-else class="add-to-list__lists">
          <li v-for="l in lists" :key="l.id">
            <label class="add-to-list__item" :class="{ 'is-busy': busy.has(l.id) }">
              <input type="checkbox" :checked="Boolean(l.workItemId)" :disabled="busy.has(l.id)" @change="toggle(l)" />
              <span class="add-to-list__name">{{ l.title }}</span>
              <span class="add-to-list__meta">
                {{ l.itemCount }} · <BaseIcon :name="l.isPublic ? 'globe' : 'lock-fill'" />
              </span>
            </label>
          </li>
        </ul>

        <form class="add-to-list__new" @submit.prevent="createWithWork">
          <input
            v-model="newTitle"
            class="app-input"
            maxlength="100"
            placeholder="Nueva lista…"
            aria-label="Nombre de la lista nueva"
          />
          <button type="submit" class="add-to-list__create" :disabled="!newTitle.trim() || creating">Crear</button>
        </form>
      </template>
    </div>
  </section>
</template>

<style scoped>
.add-to-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.add-to-list__toggle {
  align-self: flex-start;
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

.add-to-list__toggle:hover {
  border-color: var(--color-accent);
}

.add-to-list__count {
  color: var(--color-accent);
}

.add-to-list__chevron {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.add-to-list__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.add-to-list__hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.add-to-list__lists {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  max-height: 200px;
  overflow-y: auto;
}

.add-to-list__item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  color: var(--color-text);
  cursor: pointer;
}

.add-to-list__item:hover {
  background: var(--color-surface);
}

.add-to-list__item.is-busy {
  opacity: 0.6;
}

.add-to-list__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-to-list__meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.add-to-list__new {
  display: flex;
  gap: var(--space-xs);
}

.add-to-list__new .app-input {
  padding: 6px var(--space-sm);
  font-size: 0.875rem;
}

.add-to-list__create {
  padding: 0 var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-bg);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
}

.add-to-list__create:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
