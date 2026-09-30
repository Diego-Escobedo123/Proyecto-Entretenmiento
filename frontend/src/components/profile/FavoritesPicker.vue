<script setup lang="ts">
/**
 * FavoritesPicker — elegir y ordenar "Tus 5 favoritas" (como el top 4 de
 * Letterboxd, con una más) entre las obras de la propia colección, de cualquier tipo.
 * Guarda en el perfil y emite `saved` con los ids en orden.
 *
 * Uso:
 *   <FavoritesPicker v-if="abierto" :initial="profile.topPicks" @close="…" @saved="…" />
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseModal from '../BaseModal.vue'
import BaseButton from '../BaseButton.vue'
import BaseIcon from '../BaseIcon.vue'
import { typeMeta } from '../../lib/catalog'
import { useMediaStore } from '../../stores/media'
import { useProfileStore } from '../../stores/profile'
import type { MediaEntry } from '../../types/media'

const props = defineProps<{ initial: string[] }>()
const emit = defineEmits<{ close: []; saved: [ids: string[]] }>()

const MAX = 5
const media = useMediaStore()
void media.ensureLoaded()
const { entries } = storeToRefs(media)
const profileStore = useProfileStore()

const modalRef = ref<InstanceType<typeof BaseModal> | null>(null)
const picks = ref<string[]>([...props.initial])
const query = ref('')
const saving = ref(false)
const error = ref('')

const byId = computed(() => new Map(entries.value.map((e) => [e.id, e])))
/** Las elegidas que siguen en la colección, en orden. */
const chosen = computed(() => picks.value.map((id) => byId.value.get(id)).filter((e): e is MediaEntry => Boolean(e)))

/** Candidatas: favoritas y mejor calificadas primero; filtradas por el buscador. */
const candidates = computed(() => {
  const q = query.value.trim().toLowerCase()
  return [...entries.value]
    .filter((e) => !picks.value.includes(e.id) && (!q || e.title.toLowerCase().includes(q) || e.creator.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 24)
})

function add(entry: MediaEntry) {
  if (picks.value.length < MAX) picks.value = [...picks.value, entry.id]
}

function remove(id: string) {
  picks.value = picks.value.filter((p) => p !== id)
}

function move(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= picks.value.length) return
  const next = [...picks.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  picks.value = next
}

async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    // Sólo las que siguen existiendo (una borrada de la colección no se guarda).
    const ids = chosen.value.map((e) => e.id)
    await profileStore.updateProfile({ topPicks: ids })
    emit('saved', ids)
    modalRef.value?.requestClose()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron guardar tus favoritas.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal ref="modalRef" title="Tus 5 favoritas" size="lg" @close="emit('close')">
    <div class="picker">
      <p class="picker__hint">
        Las obras que mejor te definen, de cualquier tipo. Aparecen arriba en tu perfil, en este orden.
      </p>

      <ol class="picker__slots">
        <li v-for="n in MAX" :key="n" class="picker__slot">
          <template v-if="chosen[n - 1]">
            <img v-if="chosen[n - 1].cover" :src="chosen[n - 1].cover!" alt="" class="picker__cover" />
            <span v-else class="picker__cover picker__cover--empty" aria-hidden="true">
              <BaseIcon :name="typeMeta(chosen[n - 1].type).icon" />
            </span>
            <span class="picker__slot-title" :title="chosen[n - 1].title">{{ chosen[n - 1].title }}</span>
            <span class="picker__slot-actions">
              <button type="button" class="picker__icon" :disabled="n === 1" aria-label="Mover a la izquierda" @click="move(n - 1, -1)">
                <BaseIcon name="chevron-left" />
              </button>
              <button type="button" class="picker__icon" aria-label="Quitar" @click="remove(chosen[n - 1].id)">
                <BaseIcon name="x-lg" />
              </button>
              <button
                type="button"
                class="picker__icon"
                :disabled="n === chosen.length"
                aria-label="Mover a la derecha"
                @click="move(n - 1, 1)"
              >
                <BaseIcon name="chevron-right" />
              </button>
            </span>
          </template>
          <span v-else class="picker__cover picker__cover--slot" aria-hidden="true">{{ n }}</span>
        </li>
      </ol>

      <div class="picker__search">
        <BaseIcon name="search" class="picker__search-icon" />
        <input
          v-model="query"
          type="text"
          class="app-input picker__input"
          placeholder="Busca en tu colección"
          aria-label="Buscar en tu colección"
          autocomplete="off"
        />
      </div>

      <p v-if="!entries.length" class="picker__hint">Tu colección está vacía: agrega obras para elegir tus favoritas.</p>
      <p v-else-if="!candidates.length" class="picker__hint">Nada coincide con “{{ query.trim() }}”.</p>
      <ul v-else class="picker__candidates">
        <li v-for="e in candidates" :key="e.id">
          <button
            type="button"
            class="picker__candidate"
            :disabled="chosen.length >= MAX"
            :title="chosen.length >= MAX ? 'Ya elegiste 5: quita una para cambiarla' : `Agregar ${e.title}`"
            @click="add(e)"
          >
            <img v-if="e.cover" :src="e.cover" alt="" class="picker__cover" loading="lazy" />
            <span v-else class="picker__cover picker__cover--empty" aria-hidden="true">
              <BaseIcon :name="typeMeta(e.type).icon" />
            </span>
            <span class="picker__candidate-title">{{ e.title }}</span>
          </button>
        </li>
      </ul>

      <p v-if="error" class="picker__error">{{ error }}</p>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="modalRef?.requestClose()">Cancelar</BaseButton>
      <BaseButton :disabled="saving" @click="save">Guardar</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.picker__hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.picker__slots {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-sm);
}

.picker__slot {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.picker__cover {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-md);
  object-fit: cover;
  background: var(--color-surface-2);
}

.picker__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-subtle);
}

.picker__cover--slot {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--color-border);
  background: none;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-text-subtle);
}

.picker__slot-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker__slot-actions {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.picker__icon {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  cursor: pointer;
}

.picker__icon:hover:not(:disabled) {
  color: var(--color-text);
}

.picker__icon:disabled {
  opacity: 0.35;
  cursor: default;
}

.picker__search {
  position: relative;
}

.picker__search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.picker__input {
  padding-left: 40px;
}

.picker__candidates {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: var(--space-sm);
  max-height: 320px;
  overflow-y: auto;
}

.picker__candidate {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.picker__candidate:hover:not(:disabled) .picker__cover {
  outline: 2px solid var(--color-accent);
}

.picker__candidate:disabled {
  opacity: 0.45;
  cursor: default;
}

.picker__candidate-title {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker__error {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-danger);
}
</style>
