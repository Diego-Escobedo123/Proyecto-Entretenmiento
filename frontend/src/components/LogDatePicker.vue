<script setup lang="ts">
/**
 * LogDatePicker — "¿cuándo?" para el diario, con accesos rápidos en vez de un
 * calendario suelto: por defecto Hoy · Ayer · Elegir fecha · No recuerdo.
 * "Elegir fecha" abre el calendario nativo (showPicker) y el chip pasa a
 * mostrar el día elegido. "No recuerdo" sólo aparece con `allowUndated`.
 * Uso:
 *   <LogDatePicker v-model:day="logDate" v-model:undated="undated" label="¿Cuándo la viste?" allow-undated />
 *   <LogDatePicker v-model:day="start" :presets="[{ label: 'El mismo día', icon: 'arrow-repeat', day: end }]" :max="end" … />
 */
import { computed, ref, useId } from 'vue'
import BaseIcon from './BaseIcon.vue'
import { formatDay, isoDay, todayISO } from '../lib/dates'

export interface DatePreset {
  label: string
  icon: string
  /** "YYYY-MM-DD". */
  day: string
}

const day = defineModel<string>('day', { required: true })
const undated = defineModel<boolean>('undated', { default: false })

const props = defineProps<{
  label: string
  /** Texto bajo los chips cuando hay fecha. */
  hint?: string
  /** Texto bajo los chips con "No recuerdo"; si falta, el de `hint`. */
  undatedHint?: string
  /** Ofrece "No recuerdo". */
  allowUndated?: boolean
  /** Atajos; por defecto Hoy y Ayer. */
  presets?: DatePreset[]
  /** Último día elegible en el calendario; por defecto, hoy. */
  max?: string
  error?: string
}>()

const labelId = useId()
const nativeInput = ref<HTMLInputElement | null>(null)

function yesterdayISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return isoDay(d)
}

const chips = computed<DatePreset[]>(
  () =>
    props.presets ?? [
      { label: 'Hoy', icon: 'sun', day: todayISO() },
      { label: 'Ayer', icon: 'moon-stars', day: yesterdayISO() },
    ],
)

/** Qué chip está activo: el índice de un atajo, 'custom' o 'unknown'. */
const choice = computed<number | 'custom' | 'unknown'>(() => {
  if (props.allowUndated && undated.value) return 'unknown'
  const preset = chips.value.findIndex((p) => p.day === day.value)
  return preset >= 0 ? preset : 'custom'
})

function setDay(value: string) {
  day.value = value
  undated.value = false
}

/** Abre el calendario nativo; donde no hay showPicker, al menos enfoca el input. */
function openCalendar() {
  const input = nativeInput.value
  if (!input) return
  try {
    input.showPicker()
  } catch {
    input.focus()
  }
}

function onNativeChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value) setDay(value)
}

const hintText = computed(() => (choice.value === 'unknown' ? (props.undatedHint ?? props.hint) : props.hint))
</script>

<template>
  <div class="log-date">
    <span :id="labelId" class="log-date__label">{{ label }}</span>

    <div class="log-date__chips" role="group" :aria-labelledby="labelId">
      <button
        v-for="(preset, i) in chips"
        :key="preset.label"
        type="button"
        class="log-date__chip"
        :class="{ 'is-active': choice === i }"
        :aria-pressed="choice === i"
        @click="setDay(preset.day)"
      >
        <BaseIcon :name="preset.icon" /> {{ preset.label }}
      </button>

      <span class="log-date__custom">
        <button
          type="button"
          class="log-date__chip"
          :class="{ 'is-active': choice === 'custom' }"
          :aria-pressed="choice === 'custom'"
          @click="openCalendar"
        >
          <BaseIcon name="calendar3" />
          <template v-if="choice === 'custom' && day">{{ formatDay(day) }}</template>
          <template v-else>Elegir fecha</template>
        </button>
        <!-- Calendario nativo, invisible: el chip lo abre y lo ancla debajo de sí. -->
        <input
          ref="nativeInput"
          type="date"
          class="log-date__native"
          :value="day"
          :max="max ?? todayISO()"
          tabindex="-1"
          aria-hidden="true"
          @change="onNativeChange"
        />
      </span>

      <button
        v-if="allowUndated"
        type="button"
        class="log-date__chip log-date__chip--unknown"
        :class="{ 'is-active': choice === 'unknown' }"
        :aria-pressed="choice === 'unknown'"
        @click="undated = true"
      >
        <BaseIcon name="cloud-fog2" /> No recuerdo
      </button>
    </div>

    <p v-if="error" class="log-date__error">{{ error }}</p>
    <Transition v-else name="log-date-hint" mode="out-in">
      <p v-if="hintText" :key="hintText" class="log-date__hint">{{ hintText }}</p>
    </Transition>
  </div>
</template>

<style scoped>
.log-date {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.log-date__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.log-date__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.log-date__custom {
  position: relative;
  display: inline-flex;
}

.log-date__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;
}

.log-date__chip:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.log-date__chip:active {
  transform: scale(0.96);
}

.log-date__chip:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.log-date__chip.is-active {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

/* "No recuerdo": borde punteado, como una fecha que se desdibuja. */
.log-date__chip--unknown {
  border-style: dashed;
  background: none;
}

.log-date__chip--unknown.is-active {
  border-style: dashed;
  border-color: var(--color-text-muted);
  background: var(--color-accent-hover-bg);
  color: var(--color-text);
}

.log-date__native {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  border: 0;
  padding: 0;
}

.log-date__hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.log-date__error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-danger);
}

.log-date-hint-enter-active,
.log-date-hint-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.log-date-hint-enter-from,
.log-date-hint-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
