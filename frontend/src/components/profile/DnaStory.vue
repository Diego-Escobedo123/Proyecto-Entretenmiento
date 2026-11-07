<script setup lang="ts">
/**
 * DnaStory — un dato del ADN cultural dibujado como una historia con stickers
 * (barras de progreso arriba, encuesta, etiquetas). Dos variantes:
 *   decade  Década favorita: la década en dorado, su #etiqueta y una encuesta
 *           "¿Tu década?" con su parte contra el resto.
 *   format  Formato dominante: encuesta "¿Qué ves más?" con los tres tipos
 *           principales (se completa con tipos en 0% si tiene menos).
 * Todo es un SVG de 350×286 que se escala con el ancho disponible.
 *
 * Uso:
 *   <DnaStory kind="decade" :decade="2020" :percent="67" self />
 *   <DnaStory kind="format" :shares="dna.typeShares" self />
 */
import { computed, useId } from 'vue'
import goldUrl from '../../assets/insights/gold.jpg'
import { MEDIA_TYPES, typeMeta } from '../../lib/catalog'
import type { MediaType } from '../../types/media'

const props = defineProps<{
  kind: 'decade' | 'format'
  /** decade: año inicial de la década (2020) y qué parte de lo registrado es de ella. */
  decade?: number | null
  percent?: number
  /** format: parte de la colección de cada tipo, de mayor a menor. */
  shares?: { type: MediaType; percent: number }[]
  self?: boolean
}>()

const v = (tu: string, el: string) => (props.self ? tu : el)
const uid = useId()
const id = (name: string) => `${uid}-${name}`

const SANS = "'Valley Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
const SERIF = 'Merriweather, Georgia, serif'

/** Cinco barras de progreso, como en una historia. */
const SEGMENTS = [24, 85.2, 146.4, 207.6, 268.8]

// --- Década ---
const hasDecade = computed(() => props.kind === 'decade' && props.decade != null)
const decadeLabel = computed(() => `’${String((props.decade ?? 0) % 100).padStart(2, '0')}s`)

/** La etiqueta de cada década: cómo se veía (o escuchaba) lo de esa época. */
const DECADE_TAGS: Record<number, string> = {
  2020: '#streaming',
  2010: '#maratones',
  2000: '#dvd',
  1990: '#vhs',
  1980: '#casete',
  1970: '#vinilo',
  1960: '#technicolor',
}
const tag = computed(() => DECADE_TAGS[props.decade ?? 0] ?? '#clásicos')
/** Ancho aproximado del sticker según el largo de la etiqueta. */
const tagWidth = computed(() => Math.max(78, tag.value.length * 8.2 + 28))
const decadePercent = computed(() => Math.max(0, Math.min(100, Math.round(props.percent ?? 0))))

// --- Formato ---
const pollRows = computed(() => {
  const rows = [...(props.shares ?? [])].slice(0, 3)
  for (const t of MEDIA_TYPES) {
    if (rows.length >= 3) break
    if (!rows.some((r) => r.type === t.value)) rows.push({ type: t.value, percent: 0 })
  }
  return rows.map((r, i) => ({
    label: typeMeta(r.type).plural,
    percent: r.percent,
    winner: i === 0,
    y: 104 + i * 36,
  }))
})
const winner = computed(() => pollRows.value[0] ?? null)
const hasFormat = computed(() => props.kind === 'format' && (props.shares?.length ?? 0) > 0)
</script>

<template>
  <div class="story">
    <!-- Década favorita -->
    <svg
      v-if="hasDecade"
      viewBox="1.5 1.5 347 283"
      class="story__svg"
      role="img"
      :aria-label="`Década favorita: los ${decadeLabel.slice(1)}, el ${decadePercent}% de todo lo que ${v('registras', 'registra')}`"
    >
      <defs>
        <filter :id="id('glit')" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="3" result="n1" />
          <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="29" result="n2" />
          <feColorMatrix in="n1" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.92  3 0 0 0 -1.65" result="lt" />
          <feColorMatrix in="n1" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.03  0 0 0 0 0.06  0 2.4 0 0 -1.35" result="dk" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.85  0 0 14 0 -9.4" result="hi" />
          <feMerge result="spk"><feMergeNode in="dk" /><feMergeNode in="lt" /><feMergeNode in="hi" /></feMerge>
          <feComposite in="spk" in2="SourceGraphic" operator="in" result="clip" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="clip" /></feMerge>
        </filter>
        <pattern :id="id('gold')" patternUnits="userSpaceOnUse" width="335" height="200">
          <image :href="goldUrl" x="0" y="0" width="335" height="200" preserveAspectRatio="none" />
        </pattern>
      </defs>

      <rect
        v-for="(x, i) in SEGMENTS" :key="x" :x="x" y="16" width="57.2" height="4" rx="2"
        :fill="i === 4 ? '#d3bf46' : '#f3e7d8'" :fill-opacity="i === 4 ? 1 : 0.5" :filter="i === 4 ? `url(#${id('glit')})` : undefined"
      />
      <text x="24" y="46" :font-family="SANS" font-size="12.5" font-weight="700" letter-spacing="1.6" fill="#c4adb8">DÉCADA FAVORITA</text>

      <g transform="rotate(-7 100 118)">
        <text x="30" y="140" :font-family="SERIF" font-size="72" font-weight="900" fill="#f3e7d8" stroke="#f3e7d8" stroke-width="9" stroke-linejoin="round">{{ decadeLabel }}</text>
        <text x="30" y="140" :font-family="SERIF" font-size="72" font-weight="900" :fill="`url(#${id('gold')})`">{{ decadeLabel }}</text>
      </g>

      <g transform="rotate(-4 90 214)">
        <rect :x="89 - tagWidth / 2" y="198" :width="tagWidth" height="30" rx="9" fill="#862c4d" />
        <text x="89" y="218" text-anchor="middle" :font-family="SANS" font-size="13" font-weight="800" fill="#f3e7d8">{{ tag }}</text>
      </g>

      <g transform="rotate(3 248 196)">
        <rect x="172" y="140" width="154" height="112" rx="14" fill="#f3e7d8" />
        <text x="249" y="164" text-anchor="middle" :font-family="SANS" font-size="12" font-weight="800" fill="#3b1f3a">¿{{ v('Tu', 'Su') }} década?</text>
        <rect x="184" y="176" width="130" height="28" rx="8" fill="#3b1f3a" fill-opacity="0.1" />
        <rect x="184" y="176" :width="Math.max(16, 1.3 * decadePercent)" height="28" rx="8" fill="#d3bf46" :filter="`url(#${id('glit')})`" />
        <text x="194" y="194" :font-family="SANS" font-size="12" font-weight="800" fill="#3b1f3a">{{ decadeLabel }}</text>
        <text x="304" y="194" text-anchor="end" :font-family="SANS" font-size="12" font-weight="800" fill="#3b1f3a">{{ decadePercent }}%</text>
        <rect x="184" y="212" width="130" height="28" rx="8" fill="#3b1f3a" fill-opacity="0.1" />
        <rect v-if="decadePercent < 100" x="184" y="212" :width="Math.max(16, 1.3 * (100 - decadePercent))" height="28" rx="8" fill="#3b1f3a" fill-opacity="0.18" />
        <text x="194" y="230" :font-family="SANS" font-size="12" font-weight="700" fill="#3b1f3a" fill-opacity="0.7">Otras</text>
        <text x="304" y="230" text-anchor="end" :font-family="SANS" font-size="12" font-weight="700" fill="#3b1f3a" fill-opacity="0.7">{{ 100 - decadePercent }}%</text>
      </g>

      <g fill="#d3bf46">
        <path d="M176 69 L177.75 74.25 L183 76 L177.75 77.75 L176 83 L174.25 77.75 L169 76 L174.25 74.25 Z" />
        <path d="M158 104 L159.0 107.0 L162 108 L159.0 109.0 L158 112 L157.0 109.0 L154 108 L157.0 107.0 Z" />
      </g>
      <text x="24" y="266" :font-family="SERIF" font-size="12" font-style="italic" fill="#f3e7d8" fill-opacity="0.75">
        el {{ decadePercent }}% de todo lo que {{ v('registras', 'registra') }}
      </text>
    </svg>

    <!-- Formato dominante -->
    <svg
      v-else-if="hasFormat && winner"
      viewBox="1.5 1.5 347 283"
      class="story__svg"
      role="img"
      :aria-label="`Formato dominante: ${pollRows.map((r) => `${r.label} ${r.percent}%`).join(', ')}`"
    >
      <defs>
        <filter :id="id('glit')" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="3" result="n1" />
          <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="29" result="n2" />
          <feColorMatrix in="n1" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.92  3 0 0 0 -1.65" result="lt" />
          <feColorMatrix in="n1" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.03  0 0 0 0 0.06  0 2.4 0 0 -1.35" result="dk" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.85  0 0 14 0 -9.4" result="hi" />
          <feMerge result="spk"><feMergeNode in="dk" /><feMergeNode in="lt" /><feMergeNode in="hi" /></feMerge>
          <feComposite in="spk" in2="SourceGraphic" operator="in" result="clip" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="clip" /></feMerge>
        </filter>
      </defs>

      <rect v-for="x in SEGMENTS" :key="x" :x="x" y="16" width="57.2" height="4" rx="2" fill="#d3bf46" :filter="`url(#${id('glit')})`" />
      <text x="24" y="46" :font-family="SANS" font-size="12.5" font-weight="700" letter-spacing="1.6" fill="#c4adb8">FORMATO DOMINANTE</text>

      <g transform="rotate(-2 160 152)">
        <rect x="24" y="62" width="274" height="178" rx="16" fill="#f3e7d8" />
        <text x="38" y="90" :font-family="SERIF" font-size="15" font-weight="900" fill="#3b1f3a">¿Qué {{ v('ves', 've') }} más?</text>
        <template v-for="r in pollRows" :key="r.label">
          <rect x="38" :y="r.y" width="246" height="28" rx="8" fill="#3b1f3a" fill-opacity="0.08" />
          <rect
            v-if="r.percent > 0" x="38" :y="r.y" :width="Math.max(28, 2.46 * r.percent)" height="28" rx="8"
            :fill="r.winner ? '#d3bf46' : '#3b1f3a'" :fill-opacity="r.winner ? 1 : 0.18" :filter="r.winner ? `url(#${id('glit')})` : undefined"
          />
          <template v-if="r.winner">
            <circle cx="54" :cy="r.y + 14" r="8" fill="#3b1f3a" />
            <path :d="`M50 ${r.y + 14} L53 ${r.y + 17} L58 ${r.y + 11}`" fill="none" stroke="#d3bf46" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </template>
          <circle v-else cx="54" :cy="r.y + 14" r="8" fill="none" stroke="#3b1f3a" stroke-opacity="0.3" stroke-width="1.5" />
          <text x="70" :y="r.y + 18.5" :font-family="SANS" font-size="12.5" :font-weight="r.winner ? 800 : 700" fill="#3b1f3a" :fill-opacity="r.winner ? 1 : 0.55">{{ r.label }}</text>
          <text x="274" :y="r.y + 18.5" text-anchor="end" :font-family="SANS" font-size="12.5" :font-weight="r.winner ? 800 : 700" fill="#3b1f3a" :fill-opacity="r.winner ? 1 : 0.55">{{ r.percent }}%</text>
        </template>
        <text x="38" y="226" :font-family="SERIF" font-size="11.5" font-style="italic" fill="#3b1f3a" fill-opacity="0.7">
          {{ winner.percent }}% de {{ v('tus', 'sus') }} obras
        </text>
      </g>

      <g transform="rotate(12 300 84)">
        <circle cx="300" cy="84" r="32" fill="#862c4d" />
        <circle cx="300" cy="84" r="26" fill="none" stroke="#d3bf46" stroke-width="1.5" stroke-dasharray="3 3" />
        <text x="300" y="90" text-anchor="middle" :font-family="SERIF" font-size="16" font-weight="900" fill="#d3bf46">{{ winner.percent }}%</text>
      </g>
      <text x="24" y="266" :font-family="SANS" font-size="11" fill="#c4adb8">
        Respuesta: <tspan fill="#d3bf46" font-weight="800">{{ winner.label }}</tspan>
      </text>
    </svg>

    <!-- Sin datos -->
    <div v-else class="story__empty">
      <h3 class="story__kicker">{{ kind === 'decade' ? 'Década favorita' : 'Formato dominante' }}</h3>
      <p class="story__caption">{{ kind === 'decade' ? 'Sin datos aún' : 'Sin datos suficientes' }}</p>
    </div>
  </div>
</template>

<style scoped>
.story {
  aspect-ratio: 350 / 286;
  min-width: 0;
  box-sizing: border-box;
  border: 1.5px solid #6a5068;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: #46304a;
}

.story__svg {
  display: block;
  width: 100%;
  height: 100%;
}

.story__empty {
  height: 100%;
  box-sizing: border-box;
  padding: 7%;
  display: flex;
  flex-direction: column;
}

.story__kicker {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #c4adb8;
}

.story__caption {
  margin: auto 0 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.8125rem;
  color: var(--fig-cream);
  opacity: 0.75;
}
</style>
