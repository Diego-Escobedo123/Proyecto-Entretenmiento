<script setup lang="ts">
/**
 * ToastHost — muestra los avisos flotantes de useToastStore, abajo al centro
 * (en el celular, encima de la barra de navegación inferior). Va una sola vez,
 * en DefaultLayout. Una barra fina se vacía mientras el aviso sigue en
 * pantalla: así se ve cuánto tiempo queda para "Deshacer".
 */
import BaseIcon from './BaseIcon.vue'
import { useToastStore, type ToastTone } from '../stores/toast'

const toast = useToastStore()

const ICONS: Record<ToastTone, string> = {
  info: 'info-circle-fill',
  success: 'check-circle-fill',
  error: 'exclamation-circle-fill',
}
</script>

<template>
  <div class="toasts" role="region" aria-label="Avisos">
    <TransitionGroup name="toast" tag="ul" class="toasts__list">
      <li
        v-for="t in toast.toasts"
        :key="t.id"
        class="toasts__item"
        :class="`toasts__item--${t.tone}`"
        :role="t.tone === 'error' ? 'alert' : 'status'"
      >
        <BaseIcon :name="ICONS[t.tone]" class="toasts__icon" />
        <span class="toasts__message">{{ t.message }}</span>
        <button v-if="t.action" type="button" class="toasts__action" @click="toast.runAction(t.id)">
          {{ t.action.label }}
        </button>
        <button type="button" class="toasts__close" aria-label="Cerrar aviso" @click="toast.dismiss(t.id)">
          <BaseIcon name="x-lg" />
        </button>
        <span class="toasts__timer" :style="{ animationDuration: `${t.duration}ms` }" aria-hidden="true" />
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  left: 50%;
  bottom: var(--space-lg);
  z-index: 150; /* por encima de los modales: un aviso puede llegar con uno abierto */
  transform: translateX(-50%);
  width: min(440px, calc(100vw - 2 * var(--space-md)));
  pointer-events: none;
}

.toasts__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.toasts__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 12px var(--space-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-text);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  font-size: 0.875rem;
  pointer-events: auto;
}

.toasts__icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: var(--color-text-muted);
}

.toasts__item--success .toasts__icon {
  color: var(--color-success);
}

.toasts__item--error {
  border-color: color-mix(in srgb, var(--color-danger) 60%, transparent);
}

.toasts__item--error .toasts__icon {
  color: var(--color-danger);
}

.toasts__message {
  flex: 1;
  min-width: 0;
}

.toasts__action {
  flex-shrink: 0;
  padding: 4px 10px;
  border: none;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform var(--dur-fast) ease;
}

.toasts__action:active {
  transform: scale(0.95);
}

.toasts__close {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--color-text-subtle);
  font-size: 0.75rem;
  cursor: pointer;
}

.toasts__close:hover {
  color: var(--color-text);
}

/* Tiempo restante: se vacía de izquierda a derecha. */
.toasts__timer {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  background: var(--color-accent);
  opacity: 0.6;
  transform-origin: left;
  animation: toast-timer linear forwards;
}

.toasts__item--error .toasts__timer {
  background: var(--color-danger);
}

@keyframes toast-timer {
  to {
    transform: scaleX(0);
  }
}

/* Entran subiendo desde abajo; salen encogiéndose. Los demás se reacomodan. */
.toast-enter-active {
  transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-spring);
}

.toast-leave-active {
  position: absolute;
  width: 100%;
  transition: opacity var(--dur-fast) ease, transform var(--dur-fast) ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}

.toast-leave-to {
  opacity: 0;
  transform: scale(0.94);
}

.toast-move {
  transition: transform var(--dur-base) var(--ease-out);
}

/* En el celular, encima de la barra de navegación inferior. */
@media (max-width: 860px) {
  .toasts {
    bottom: calc(var(--bottom-nav-height) + var(--space-sm) + env(safe-area-inset-bottom, 0px));
  }
}
</style>
