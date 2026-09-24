<script setup lang="ts">
/**
 * CulturalStory — experiencia de "historias" a pantalla completa (estilo
 * Spotify Wrapped / Instagram Stories) para repasar el año cultural del
 * usuario. Avanza sola cada `SLIDE_MS`, con barras de progreso arriba;
 * se puede tocar/clickear a los lados para navegar, mantener presionado
 * para pausar, o usar las flechas del teclado. Cierra con ESC o el botón.
 *
 * Uso:
 *   <CulturalStory :slides="storySlides" @close="open = false" />
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseIcon from './BaseIcon.vue'

export interface StorySlide {
  eyebrow: string
  title: string
  value?: string
  caption: string
  background: string
}

const props = defineProps<{ slides: StorySlide[] }>()
const emit = defineEmits<{ close: [] }>()

const SLIDE_MS = 5000

const index = ref(0)
const progress = ref(0)
const paused = ref(false)
let rafId = 0
let lastTs: number | null = null

const isLastSlide = () => index.value === props.slides.length - 1

function tick(ts: number) {
  if (lastTs == null) lastTs = ts
  const dt = ts - lastTs
  lastTs = ts
  if (!paused.value) {
    progress.value = Math.min(1, progress.value + dt / SLIDE_MS)
    if (progress.value >= 1) next()
  }
  rafId = requestAnimationFrame(tick)
}

function next() {
  if (isLastSlide()) {
    progress.value = 1
    paused.value = true
    return
  }
  index.value++
  progress.value = 0
}

function prev() {
  if (index.value === 0) {
    progress.value = 0
    return
  }
  index.value--
  progress.value = 0
}

function restart() {
  index.value = 0
  progress.value = 0
  paused.value = false
}

function onAreaClick(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = (event.clientX - rect.left) / rect.width
  if (ratio < 0.3) prev()
  else next()
}

function onPointerDown() {
  paused.value = true
}

function onPointerUp() {
  paused.value = isLastSlide()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
  else if (event.key === 'ArrowRight') next()
  else if (event.key === 'ArrowLeft') prev()
}

watch(index, (i) => {
  if (i === props.slides.length - 1) paused.value = true
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <Teleport to="body">
    <div class="story" :style="{ background: slides[index].background }">
      <div class="story__bars">
        <span v-for="(_, i) in slides" :key="i" class="story__bar">
          <span
            class="story__bar-fill"
            :style="{ width: (i < index ? 100 : i === index ? progress * 100 : 0) + '%' }"
          />
        </span>
      </div>

      <button class="story__close" type="button" aria-label="Cerrar" @click="emit('close')">
        <BaseIcon name="x-lg" />
      </button>

      <div
        class="story__stage"
        @click="onAreaClick"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
      >
        <div :key="index" class="story__content">
          <span class="story__eyebrow">{{ slides[index].eyebrow }}</span>
          <strong v-if="slides[index].value" class="story__value">{{ slides[index].value }}</strong>
          <h2 class="story__title">{{ slides[index].title }}</h2>
          <p class="story__caption">{{ slides[index].caption }}</p>
        </div>
      </div>

      <div v-if="isLastSlide()" class="story__footer">
        <button class="story__replay" type="button" @click="restart">
          <BaseIcon name="arrow-counterclockwise" /> Ver de nuevo
        </button>
        <button class="story__done" type="button" @click="emit('close')">Listo</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.story {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  color: var(--fig-cream);
}

.story__bars {
  display: flex;
  gap: 4px;
  padding: var(--space-md) var(--space-md) 0;
}

.story__bar {
  flex: 1;
  height: 3px;
  border-radius: 999px;
  background: rgba(243, 231, 216, 0.25);
  overflow: hidden;
}

.story__bar-fill {
  display: block;
  height: 100%;
  background: var(--fig-cream);
  transition: width 0.1s linear;
}

.story__close {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.2);
  color: var(--fig-cream);
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
}

.story__stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  text-align: center;
  cursor: pointer;
  user-select: none;
}

.story__content {
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  animation: story-in 0.35s ease;
}

@keyframes story-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.story__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--rose);
}

.story__value {
  font-size: clamp(3rem, 12vw, 5.5rem);
  font-weight: 800;
  color: var(--color-accent);
  line-height: 1;
}

.story__title {
  font-size: clamp(1.375rem, 5vw, 2rem);
  font-weight: 800;
  margin: 0;
  line-height: 1.25;
}

.story__caption {
  color: var(--rose);
  font-size: 1rem;
  line-height: 1.5;
  margin: 0;
}

.story__footer {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-lg);
}

.story__replay,
.story__done {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  border-radius: 999px;
  padding: var(--space-sm) var(--space-lg);
  font-weight: 700;
  font-size: 0.9375rem;
  cursor: pointer;
  border: 1px solid rgba(243, 231, 216, 0.3);
  background: rgba(243, 231, 216, 0.1);
  color: var(--fig-cream);
}

.story__done {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  border-color: transparent;
}
</style>
