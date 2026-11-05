<script setup lang="ts">
/**
 * InsightCard — un insight del perfil como carta coleccionable: al frente la
 * ilustración, el título y el dato; al reverso, la frase que lo explica.
 * Se voltea al tocarla (o con Enter/Espacio).
 *
 * Todo se dibuja en una carta de 340×432 y se escala con el ancho real
 * (`--u` = 1px del diseño), así se ve igual en una fila de tres que sola.
 *
 * Uso:
 *   <InsightCard title="Velocidad" label="Promedio" value="3" unit="días" art-bg="raspberry">
 *     <template #art><InsightArt kind="speed" /></template>
 *     Una serie te dura <em>3 días</em> en promedio.
 *   </InsightCard>
 *
 * El slot por defecto es el reverso: lo que vaya en <em> se resalta.
 */
import { computed, onMounted, onUpdated, ref } from 'vue'
import figUrl from '../../assets/insights/fig.png'
import starUrl from '../../assets/insights/star-gold.png'

const props = withDefaults(
  defineProps<{
    title: string
    /** Chip del pie ("Promedio", "En común"…). */
    label: string
    value: string | number
    /** Va pegada al número, más chica ("días", "%"). */
    unit?: string
    /** Estrella dorada después del número (insights de notas). */
    star?: boolean
    /** Fondo de la ilustración. */
    artBg?: 'dark' | 'raspberry'
  }>(),
  { unit: '', star: false, artBg: 'dark' },
)

const flipped = ref(false)

/*
 * Que nada se salga de la carta, sea cual sea su ancho (todo va en `--u`, así
 * que basta con calcularlo una vez sobre la carta de 340px):
 * - Título: 37px, salvo que su palabra más larga no quepa en una línea
 *   ("CALIFICACIONES"); entonces se achica lo justo. ~0.66em por letra en
 *   mayúsculas de Alegreya Sans SC, y 290px de ancho útil.
 * - Reverso: 26px; si la frase es muy larga (títulos de obras largos), se
 *   achica para entrar en el alto de la carta.
 */
const TITLE_WIDTH = 290
const titleSize = computed(() => {
  const longest = Math.max(...props.title.split(/\s+/).map((w) => w.length))
  return Math.min(37, TITLE_WIDTH / (longest * 0.66))
})

/** Caracteres que entran cómodos al tamaño normal del reverso. */
const BACK_CAPACITY = 130
const sentenceEl = ref<HTMLElement | null>(null)
const backScale = ref(1)
function fitSentence() {
  const length = sentenceEl.value?.textContent?.replace(/\s+/g, ' ').trim().length ?? 0
  backScale.value = length ? Math.max(0.65, Math.min(1, Math.sqrt(BACK_CAPACITY / length))) : 1
}
onMounted(fitSentence)
onUpdated(fitSentence)
</script>

<template>
  <article class="icard" :class="{ 'is-flipped': flipped }">
    <div class="icard__inner">
      <!-- Frente -->
      <div class="icard__face icard__front" :aria-hidden="flipped">
        <div class="icard__frame">
          <div class="icard__art" :class="`icard__art--${artBg}`">
            <slot name="art" />
          </div>
          <div class="icard__head">
            <h4 class="icard__title" :style="{ '--title-size': titleSize }">{{ title }}</h4>
            <div class="icard__ornament" aria-hidden="true">
              <svg viewBox="0 0 125 6" class="icard__rule">
                <path d="M0 3 C 30 2.2, 80 1, 125 0.6 L125 5.4 C 80 5, 30 3.9, 0 3 Z" />
              </svg>
              <img :src="figUrl" alt="" class="icard__fig" />
              <svg viewBox="0 0 125 6" class="icard__rule">
                <path d="M125 3 C 95 2.2, 45 1, 0 0.6 L0 5.4 C 45 5, 95 3.9, 125 3 Z" />
              </svg>
            </div>
          </div>
          <p class="icard__foot">
            <span class="icard__label">{{ label }}</span>
            <span class="icard__value">
              {{ value }}<span v-if="unit" class="icard__unit">{{ unit }}</span>
            </span>
            <img v-if="star" :src="starUrl" alt="estrellas" class="icard__star" />
          </p>
        </div>
      </div>

      <!-- Reverso -->
      <div class="icard__face icard__back" :aria-hidden="!flipped">
        <p ref="sentenceEl" class="icard__sentence" :style="{ '--back-scale': backScale }"><slot /></p>
      </div>
    </div>

    <button
      type="button"
      class="icard__flip"
      :aria-pressed="flipped"
      :aria-label="flipped ? `${title}: ver el frente` : `${title}: voltear la carta`"
      @click="flipped = !flipped"
    />
  </article>
</template>

<style scoped>
/* La carta mide lo que le dé la grilla; adentro todo va en unidades del diseño. */
.icard {
  container-type: inline-size;
  position: relative;
  aspect-ratio: 340 / 432;
  min-width: 0;
  perspective: 1200px;
  font-family: var(--font-card);
}

.icard__inner {
  --u: calc(100cqi / 340);
  position: relative;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform var(--dur-slow) var(--ease-out);
}

.icard.is-flipped .icard__inner {
  transform: rotateY(180deg);
}

.icard__face {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  /* Mismo borde que las historias del ADN (DnaStory). */
  border: 1.5px solid #6a5068;
  border-radius: var(--radius-lg);
  background: #423248;
  color: #f8f0e0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  box-shadow: 0 calc(6 * var(--u)) calc(18 * var(--u)) rgb(0 0 0 / 0.25);
}

/* --- Frente --- */
/* El relleno ocupa el lugar del borde grueso de antes, así el contenido no se corre. */
.icard__front {
  padding: calc(8 * var(--u) - 1.5px);
}

.icard__frame {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  border: calc(4 * var(--u)) solid transparent;
  padding: calc(6 * var(--u)) calc(6 * var(--u)) 0;
}

.icard__art {
  flex: none;
  height: calc(208 * var(--u));
  box-sizing: border-box;
  border: calc(2 * var(--u)) solid #5e4a62;
  border-radius: calc(10 * var(--u));
  overflow: hidden;
  position: relative;
}

.icard__art--dark {
  background: var(--fig-purple);
}

.icard__art--raspberry {
  background: #92174a;
}

.icard__head {
  flex: none;
  height: calc(112 * var(--u));
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: calc(8 * var(--u));
  padding-top: calc(4 * var(--u));
}

.icard__title {
  margin: 0;
  font-size: calc(var(--title-size, 37) * var(--u));
  font-weight: 800;
  line-height: 0.92;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  text-align: center;
  color: #f8f0e0;
  text-wrap: balance;
}

.icard__ornament {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(12 * var(--u));
}

.icard__rule {
  flex: none;
  width: calc(125 * var(--u));
  height: calc(6 * var(--u));
  fill: #dd2180;
}

.icard__fig {
  flex: none;
  width: calc(29 * var(--u));
  height: calc(39 * var(--u));
  margin: calc(-8 * var(--u)) calc(-3 * var(--u)) 0;
}

/* Chip + número (+ estrella), centrados bajo el título. */
.icard__foot {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(6 * var(--u));
  margin: 0;
  padding: 0 0 calc(6 * var(--u));
  min-width: 0;
}

.icard__label {
  flex: none;
  height: calc(24 * var(--u));
  display: inline-flex;
  align-items: center;
  padding: 0 calc(11 * var(--u));
  border-radius: calc(7 * var(--u));
  background: #2e2234;
  font-size: calc(17 * var(--u));
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}

.icard__value {
  display: inline-flex;
  align-items: baseline;
  font-family: var(--font-card-number);
  font-size: calc(48 * var(--u));
  font-weight: 800;
  line-height: 1;
  color: #ffe7b8;
  text-shadow: calc(2 * var(--u)) calc(2 * var(--u)) 0 var(--deep-raspberry);
  white-space: nowrap;
}

.icard__unit {
  font-size: calc(24 * var(--u));
  margin-left: calc(3 * var(--u));
}

.icard__star {
  flex: none;
  width: calc(48 * var(--u));
  height: calc(47 * var(--u));
  margin-left: calc(2 * var(--u));
}

/* --- Reverso --- */
.icard__back {
  transform: rotateY(180deg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(33 * var(--u)) calc(35 * var(--u)) calc(45 * var(--u));
}

.icard__sentence {
  margin: 0;
  font-size: calc(26 * var(--back-scale, 1) * var(--u));
  font-weight: 800;
  line-height: 1.28;
  letter-spacing: 0.025em;
  text-transform: uppercase;
  text-align: center;
  color: var(--fig-cream);
  overflow-wrap: anywhere;
}

.icard__sentence :slotted(em) {
  font-style: normal;
  color: #ffd34d;
}

/* Toda la carta es el botón para voltearla. */
.icard__flip {
  position: absolute;
  inset: 0;
  z-index: 1;
  padding: 0;
  border: 0;
  border-radius: var(--radius-lg);
  background: transparent;
  cursor: pointer;
}

.icard__flip:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 3px;
}

@media (hover: hover) {
  .icard:hover .icard__inner {
    transform: translateY(-3px);
  }

  .icard.is-flipped:hover .icard__inner {
    transform: rotateY(180deg) translateY(-3px);
  }
}

/* Sin giro: cambia de cara con un fundido. */
@media (prefers-reduced-motion: reduce) {
  .icard__inner,
  .icard.is-flipped .icard__inner,
  .icard:hover .icard__inner,
  .icard.is-flipped:hover .icard__inner {
    transform: none;
    transition: none;
  }

  .icard__face {
    backface-visibility: visible;
    transition: opacity var(--dur-base) linear;
  }

  .icard__back {
    transform: none;
    opacity: 0;
  }

  .icard.is-flipped .icard__front {
    opacity: 0;
  }

  .icard.is-flipped .icard__back {
    opacity: 1;
  }
}
</style>
