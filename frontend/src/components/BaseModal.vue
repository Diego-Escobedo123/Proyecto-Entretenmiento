<script setup lang="ts">
/**
 * BaseModal — diálogo modal accesible reutilizable.
 * - Cierra con ESC o clic en el backdrop.
 * - Bloquea el scroll del body mientras está abierto.
 * - Mueve el foco al panel al abrir y lo restituye al cerrar.
 *
 * Uso:
 *   <BaseModal v-if="open" title="Nueva obra" @close="open = false">
 *     ...contenido...
 *     <template #footer> <BaseButton>Guardar</BaseButton> </template>
 *   </BaseModal>
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BaseIcon from './BaseIcon.vue'

withDefaults(defineProps<{ title: string; size?: 'md' | 'lg' }>(), {
  size: 'md',
})

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  previouslyFocused = document.activeElement as HTMLElement | null
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
  panel.value?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  previouslyFocused?.focus?.()
})
</script>

<template>
  <div class="modal" @click.self="emit('close')">
    <div
      ref="panel"
      class="modal__panel"
      :class="`modal__panel--${size}`"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
    >
      <header class="modal__header">
        <h2 class="modal__title">{{ title }}</h2>
        <button class="modal__close" type="button" aria-label="Cerrar" @click="emit('close')">
          <BaseIcon name="x-lg" />
        </button>
      </header>

      <div class="modal__body">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="modal__footer">
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--space-lg);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  overflow-y: auto;
}

.modal__panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: 100%;
  margin: auto;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - var(--space-xl));
  outline: none;
}

.modal__panel--md {
  max-width: 440px;
}
.modal__panel--lg {
  max-width: 640px;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.modal__title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.modal__close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  line-height: 1;
}
.modal__close:hover,
.modal__close:active {
  color: var(--color-accent-hover-contrast);
  background: var(--color-accent-hover-bg);
}

.modal__body {
  padding: var(--space-lg);
  overflow-y: auto;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg) var(--space-lg);
  border-top: 1px solid var(--color-border);
}
</style>
