/**
 * Avisos flotantes (toasts): confirman lo que pasó ("Se eliminó «Dune»") o
 * avisan de un error, sin interrumpir. Pueden traer una acción, como
 * "Deshacer". Los muestra <ToastHost /> (en DefaultLayout).
 *
 * Uso:
 *   const toast = useToastStore()
 *   toast.error('No se pudo seguir a esta persona.')
 *   toast.show('Se eliminó «Dune»', { action: { label: 'Deshacer', run: undo } })
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  message: string
  tone: ToastTone
  action?: ToastAction
  /** Milisegundos en pantalla. */
  duration: number
}

/** Más de esto y el más viejo se va: que no se apilen tapando la pantalla. */
const MAX_VISIBLE = 3
const DEFAULT_MS = 4000

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 1
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  function dismiss(id: number) {
    clearTimeout(timers.get(id))
    timers.delete(id)
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function show(message: string, options: { tone?: ToastTone; action?: ToastAction; duration?: number } = {}): number {
    const toast: Toast = {
      id: nextId++,
      message,
      tone: options.tone ?? 'info',
      action: options.action,
      duration: options.duration ?? DEFAULT_MS,
    }
    toasts.value = [...toasts.value, toast]
    while (toasts.value.length > MAX_VISIBLE) dismiss(toasts.value[0].id)
    timers.set(toast.id, setTimeout(() => dismiss(toast.id), toast.duration))
    return toast.id
  }

  /** Corre la acción del aviso (p. ej. "Deshacer") y lo cierra. */
  function runAction(id: number) {
    const toast = toasts.value.find((t) => t.id === id)
    dismiss(id)
    toast?.action?.run()
  }

  const success = (message: string) => show(message, { tone: 'success' })
  const error = (message: string) => show(message, { tone: 'error', duration: 6000 })

  return { toasts, show, success, error, dismiss, runAction }
})
