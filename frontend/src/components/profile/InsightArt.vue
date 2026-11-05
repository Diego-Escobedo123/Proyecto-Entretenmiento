<script setup lang="ts">
/**
 * InsightArt — la ilustración del frente de cada carta de insight (InsightCard).
 * Son SVG de 308×210 que llenan el recuadro; los textos y cantidades que
 * aparecen en el dibujo (años, veces, notas, días…) vienen de los datos.
 *
 * Texturas: `leaf` (plata) y `goldleaf` (oro) se aplican como patrón encima
 * del color; `glit` les pone brillos. Los ids llevan `useId()` para que varias
 * cartas en la misma página no se pisen.
 *
 * Uso:
 *   <InsightArt kind="timeTravel" :year="1942" :seen-year="2026" />
 */
import { computed, useId } from 'vue'
import fishUrl from '../../assets/insights/against-fish.jpg'
import leafUrl from '../../assets/insights/leaf.png'
import goldleafUrl from '../../assets/insights/goldleaf.jpg'

type Kind =
  | 'against'
  | 'speed'
  | 'timeTravel'
  | 'rewatch'
  | 'affinity'
  | 'harsher'
  | 'era'
  | 'explorer'
  | 'streak'
  | 'weekday'
  | 'backlog'
  | 'constancy'
  | 'ratings'
  | 'day'

const props = defineProps<{
  kind: Kind
  /** timeTravel: estreno y año en que la vio. */
  year?: number
  seenYear?: number
  /** rewatch: veces que la terminó. */
  times?: number
  /** harsher: nota y tipo de cada paleta (la severa a la izquierda). */
  strict?: { value: string; label: string }
  soft?: { value: string; label: string }
  /** era: pesa más lo reciente (la balanza baja del lado de "Ahora"). */
  recentHeavy?: boolean
  /** explorer: hasta 4 nombres de géneros para las islas. */
  genres?: string[]
  /** streak: semanas de la racha (un bloque por semana, hasta 8). */
  weeks?: number
  /** weekday: el día fuerte, 0 = lunes … 6 = domingo. */
  topDay?: number
  /** constancy: 0–100, dónde va el escalador. */
  progress?: number
  /** day: mes corto ("MAR") y día. */
  month?: string
  day?: number
  /** Texto para lectores de pantalla. */
  label: string
}>()

const uid = useId()
const id = (name: string) => `${uid}-${name}`
const url = (name: string) => `url(#${id(name)})`

/** Estrella de 5 puntas centrada en 0,0 (radio 10). */
const STAR = 'M0 -10 L2.35 -3.24 L9.51 -3.09 L3.8 1.24 L5.88 8.09 L0 4 L-5.88 8.09 L-3.8 1.24 L-9.51 -3.09 L-2.35 -3.24 Z'

// --- Explorador: nombres de las islas ---
const ISLANDS = [
  { x: 80, y: 104 },
  { x: 208, y: 92 },
  { x: 238, y: 174 },
  { x: 132, y: 174 },
]
const islandLabels = computed(() =>
  (props.genres ?? []).slice(0, 4).map((g, i) => ({
    ...ISLANDS[i],
    text: g.length > 11 ? `${g.slice(0, 10)}…` : g,
  })),
)

// --- Racha: un bloque por semana, centrados ---
const streakBlocks = computed(() => {
  const n = Math.max(1, Math.min(props.weeks ?? 8, 8))
  const start = 154 - (n * 28 - 6) / 2
  return Array.from({ length: n }, (_, i) => start + i * 28)
})

// --- Eres de martes: siete círculos, el día fuerte grande y con corona ---
const WEEK_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const weekCircles = computed(() => {
  const top = props.topDay ?? 1
  let edge = 0
  const raw = WEEK_INITIALS.map((initial, i) => {
    const big = i === top
    const r = big ? 36 : 14
    const gap = i === 0 ? 0 : big ? 8 : i - 1 === top ? 12 : 6
    const cx = edge + gap + r
    edge = cx + r
    return { initial, big, cx }
  })
  // Centrado como en el diseño (de 16 a 300).
  const shift = 158 - edge / 2
  return raw.map((c) => ({ ...c, cx: c.cx + shift }))
})
const crownX = computed(() => (weekCircles.value.find((c) => c.big)?.cx ?? 88) - 88)

// --- Constancia: el escalador avanza por el sendero según el % ---
const TRAIL: [number, number][] = [
  [44, 200],
  [104, 168],
  [78, 140],
  [118, 112],
  [106, 88],
  [122, 70],
  [128, 48],
]
const trailPath = `M${TRAIL.map((p) => p.join(' ')).join(' L')}`
const climber = computed(() => {
  const segs = TRAIL.slice(1).map((p, i) => {
    const [x0, y0] = TRAIL[i]
    return { x0, y0, dx: p[0] - x0, dy: p[1] - y0, len: Math.hypot(p[0] - x0, p[1] - y0) }
  })
  const total = segs.reduce((a, s) => a + s.len, 0)
  let left = (Math.max(0, Math.min(100, props.progress ?? 0)) / 100) * total
  for (const s of segs) {
    if (left <= s.len) return { x: s.x0 + (s.dx * left) / s.len, y: s.y0 + (s.dy * left) / s.len }
    left -= s.len
  }
  return { x: TRAIL[TRAIL.length - 1][0], y: TRAIL[TRAIL.length - 1][1] }
})

// --- ¿Presente o pasado?: la balanza baja del lado que pesa más ---
const tilt = computed(() => (props.recentHeavy === false ? { left: 25, right: -25 } : { left: 0, right: 0 }))
</script>

<template>
  <!-- Contra la corriente: ilustración en imagen, con brillos sobre el pez verde -->
  <div v-if="kind === 'against'" class="art art--image" role="img" :aria-label="label">
    <img :src="fishUrl" alt="" class="art__img" />
    <svg viewBox="0 0 300 204" preserveAspectRatio="xMidYMid slice" class="art__svg" aria-hidden="true">
      <defs>
        <filter :id="id('glitonly')" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="3" result="n1" />
          <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="29" result="n2" />
          <feColorMatrix in="n1" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.92  3 0 0 0 -1.65" result="lt" />
          <feColorMatrix in="n1" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.03  0 0 0 0 0.06  0 2.4 0 0 -1.35" result="dk" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.85  0 0 14 0 -9.4" result="hi" />
          <feMerge result="spk"><feMergeNode in="dk" /><feMergeNode in="lt" /><feMergeNode in="hi" /></feMerge>
          <feComposite in="spk" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <ellipse cx="157" cy="106" rx="37" ry="19" fill="#b5d334" :filter="url('glitonly')" />
    </svg>
  </div>

  <svg v-else viewBox="0 0 308 210" preserveAspectRatio="xMidYMid slice" class="art art__svg" role="img" :aria-label="label">
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
      <linearGradient :id="id('sheen')" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.08" />
        <stop offset="0.28" stop-color="#fffbe8" stop-opacity="0.6" />
        <stop offset="0.4" stop-color="#ffffff" stop-opacity="0.12" />
        <stop offset="0.52" stop-color="#000000" stop-opacity="0.14" />
        <stop offset="0.6" stop-color="#ffffff" stop-opacity="0.18" />
        <stop offset="0.66" stop-color="#000000" stop-opacity="0.22" />
        <stop offset="1" stop-color="#ffffff" stop-opacity="0.12" />
      </linearGradient>
      <pattern :id="id('leaf')" patternUnits="userSpaceOnUse" width="268" height="160">
        <image :href="leafUrl" x="0" y="0" width="268" height="160" preserveAspectRatio="none" />
      </pattern>
      <pattern v-if="kind === 'streak'" :id="id('goldleaf')" patternUnits="userSpaceOnUse" x="96" y="18" width="268" height="160">
        <image :href="goldleafUrl" x="0" y="0" width="268" height="160" preserveAspectRatio="xMidYMid slice" />
      </pattern>
    </defs>

    <!-- Velocidad: reloj de arena disparado -->
    <template v-if="kind === 'speed'">
      <g stroke="#3b1f3a" stroke-linecap="round" stroke-width="6">
        <line x1="30" y1="72" x2="104" y2="72" />
        <line x1="56" y1="98" x2="112" y2="98" stroke-opacity="0.55" />
        <line x1="20" y1="124" x2="108" y2="124" />
        <line x1="62" y1="150" x2="104" y2="150" stroke-opacity="0.55" />
      </g>
      <g transform="rotate(14 178 110)">
        <path d="M148 50 L208 50 L186 110 L208 170 L148 170 L170 110 Z" fill="#54324d" />
        <path d="M160 70 L196 70 L182 104 L174 104 Z" fill="#9d2d27" :filter="url('glit')" />
        <line x1="178" y1="104" x2="178" y2="152" stroke="#9d2d27" stroke-width="3" />
        <path d="M154 170 Q178 138 202 170 Z" fill="#9d2d27" :filter="url('glit')" />
        <template v-for="r in [[141, 160, 74, 12], [141, 40, 74, 12], [143, 50, 5, 112], [208, 50, 5, 112]]" :key="r.join()">
          <rect :x="r[0]" :y="r[1]" :width="r[2]" :height="r[3]" rx="4" fill="#556a07" />
          <rect :x="r[0]" :y="r[1]" :width="r[2]" :height="r[3]" rx="4" :fill="url('sheen')" />
        </template>
      </g>
      <template v-for="fill in ['#8aa63c', url('leaf')]" :key="fill">
        <g :fill="fill">
          <path d="M252 46 L256 56 L266 60 L256 64 L252 74 L248 64 L238 60 L248 56 Z" />
          <path d="M270 128 L272.5 134 L278 136 L272.5 138 L270 144 L267.5 138 L262 136 L267.5 134 Z" />
        </g>
      </template>
    </template>

    <!-- Viaje en el tiempo: portal-reloj y camino de un año a otro -->
    <template v-else-if="kind === 'timeTravel'">
      <circle cx="96" cy="108" r="80" fill="#862c4d" />
      <circle cx="96" cy="108" r="80" :fill="url('leaf')" />
      <circle cx="96" cy="108" r="63" fill="#54324d" />
      <circle cx="96" cy="108" r="47" fill="#9d2d27" :filter="url('glit')" />
      <circle cx="96" cy="108" r="32" fill="#3b1f3a" />
      <circle cx="96" cy="108" r="18" fill="#556a07" />
      <circle cx="96" cy="108" r="18" :fill="url('sheen')" />
      <g fill="#8aa63c">
        <circle cx="96" cy="36" r="3" /><circle cx="168" cy="108" r="3" />
        <circle cx="96" cy="180" r="3" /><circle cx="24" cy="108" r="3" />
      </g>
      <line x1="96" y1="108" x2="96" y2="80" stroke="#f3e7d8" stroke-width="4" stroke-linecap="round" />
      <line x1="96" y1="108" x2="116" y2="116" stroke="#f3e7d8" stroke-width="4" stroke-linecap="round" />
      <circle cx="96" cy="108" r="4.5" fill="#3b1f3a" />
      <path d="M150 70 C 214 30, 286 70, 262 136" fill="none" stroke="#862c4d" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round" />
      <g transform="rotate(-8 174 55)">
        <rect x="150" y="44" width="48" height="22" rx="5" fill="#862c4d" />
        <text x="174" y="60" text-anchor="middle" class="art__text" font-size="12" font-weight="700" fill="#f3e7d8">{{ year }}</text>
      </g>
      <rect x="222" y="138" width="70" height="32" rx="6" fill="#556a07" />
      <rect x="222" y="138" width="70" height="32" rx="6" :fill="url('sheen')" />
      <text x="257" y="160" text-anchor="middle" class="art__text" font-size="17" font-weight="800" fill="#f3e7d8">{{ seenYear }}</text>
      <path d="M262 128 L262 137 M257 132 L262 137 L267 132" fill="none" stroke="#862c4d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <!-- Vuelves a…: casete con flecha de repetición -->
    <template v-else-if="kind === 'rewatch'">
      <path d="M184 22 A88 88 0 1 1 124 22" fill="none" stroke="#8aa63c" stroke-width="5" stroke-linecap="round" />
      <polygon points="134,18.4 126.4,28.6 121.6,15.4" fill="#8aa63c" />
      <rect x="84" y="60" width="140" height="92" rx="10" fill="#9d2d27" />
      <rect x="84" y="60" width="140" height="92" rx="10" :fill="url('leaf')" />
      <rect x="98" y="70" width="112" height="56" rx="5" fill="#862c4d" />
      <rect x="106" y="76" width="60" height="5" rx="2.5" fill="#f3e7d8" fill-opacity="0.8" />
      <rect x="106" y="85" width="40" height="4" rx="2" fill="#f3e7d8" fill-opacity="0.4" />
      <rect x="118" y="96" width="72" height="24" rx="12" fill="#3b1f3a" />
      <template v-for="cx in [130, 178]" :key="cx">
        <circle :cx="cx" cy="108" r="9" fill="#556a07" />
        <circle :cx="cx" cy="108" r="9" :fill="url('sheen')" />
        <circle :cx="cx" cy="108" r="3.5" fill="#3b1f3a" />
      </template>
      <path d="M139 108 L169 108" stroke="#9d2d27" stroke-width="3" />
      <path d="M108 152 L118 136 L190 136 L200 152 Z" fill="#862c4d" />
      <circle cx="132" cy="144" r="3" fill="#3b1f3a" />
      <circle cx="176" cy="144" r="3" fill="#3b1f3a" />
      <rect x="214" y="46" width="42" height="24" rx="12" fill="#556a07" :filter="url('glit')" />
      <text x="235" y="63" text-anchor="middle" class="art__text" font-size="13" font-weight="800" fill="#f3e7d8">×{{ times }}</text>
      <g fill="#862c4d">
        <path d="M46 150 L48.5 156 L54 158 L48.5 160 L46 166 L43.5 160 L38 158 L43.5 156 Z" />
        <path d="M262 160 L264 165 L269 167 L264 169 L262 174 L260 169 L255 167 L260 165 Z" />
      </g>
    </template>

    <!-- Afinidad: dos personas y un balde de palomitas -->
    <template v-else-if="kind === 'affinity'">
      <rect x="56" y="122" width="76" height="100" rx="34" fill="#862c4d" />
      <rect x="176" y="122" width="76" height="100" rx="34" fill="#556a07" />
      <circle cx="94" cy="96" r="25" fill="#9d2d27" />
      <path d="M69 92 C 70 70, 116 66, 119 90 C 106 82, 86 80, 69 92 Z" fill="#862c4d" />
      <circle cx="214" cy="96" r="25" fill="#9d2d27" />
      <path d="M189 96 C 186 66, 240 64, 239 92 C 236 106, 240 116, 236 124 L230 100 C 220 84, 200 84, 189 96 Z" fill="#556a07" />
      <line x1="116" y1="148" x2="142" y2="142" stroke="#862c4d" stroke-width="13" stroke-linecap="round" />
      <line x1="192" y1="148" x2="166" y2="142" stroke="#556a07" stroke-width="13" stroke-linecap="round" />
      <template v-for="fill in ['#f3e7d8', url('leaf')]" :key="fill">
        <g :fill="fill">
          <circle cx="138" cy="140" r="9" /><circle cx="151" cy="132" r="10" />
          <circle cx="165" cy="136" r="9" /><circle cx="175" cy="142" r="7" />
          <circle cx="157" cy="143" r="8" /><circle cx="133" cy="146" r="6" />
        </g>
      </template>
      <path d="M130 148 L178 148 L170 206 L138 206 Z" fill="#9d2d27" :filter="url('glit')" />
      <path d="M142 148 L148 148 L147 206 L142 206 Z" fill="#862c4d" />
      <path d="M160 148 L166 148 L164 206 L159 206 Z" fill="#862c4d" />
      <path d="M154 74 C 138 62, 142 44, 154 54 C 166 44, 170 62, 154 74 Z" fill="#9d2d27" />
      <path d="M154 74 C 138 62, 142 44, 154 54 C 166 44, 170 62, 154 74 Z" :fill="url('sheen')" />
      <path d="M176 46 C 168 40, 170 30, 176 35 C 182 30, 184 40, 176 46 Z" fill="#8aa63c" />
      <path d="M176 46 C 168 40, 170 30, 176 35 C 182 30, 184 40, 176 46 Z" :fill="url('sheen')" />
      <path d="M134 40 C 128 35, 130 27, 134 31 C 138 27, 140 35, 134 40 Z" fill="#862c4d" />
    </template>

    <!-- Más exigente con…: dos paletas de jurado -->
    <template v-else-if="kind === 'harsher'">
      <g transform="rotate(-8 96 110)">
        <rect x="91" y="120" width="10" height="72" rx="4" fill="#3b1f3a" />
        <circle cx="96" cy="82" r="48" fill="#9d2d27" />
        <circle cx="96" cy="82" r="48" :fill="url('leaf')" />
        <circle cx="96" cy="82" r="48" fill="none" stroke="#3b1f3a" stroke-width="4" />
        <text x="96" y="90" text-anchor="middle" class="art__text" font-size="30" font-weight="800" fill="#f3e7d8">{{ strict?.value }}</text>
        <text x="96" y="110" text-anchor="middle" class="art__text" font-size="9" font-weight="700" letter-spacing="1.2" fill="#f3e7d8">{{ strict?.label.toUpperCase() }}</text>
      </g>
      <g transform="rotate(7 212 110)">
        <rect x="207" y="120" width="10" height="72" rx="4" fill="#3b1f3a" />
        <circle cx="212" cy="82" r="48" fill="#556a07" :filter="url('glit')" />
        <circle cx="212" cy="82" r="48" fill="none" stroke="#3b1f3a" stroke-width="4" />
        <text x="212" y="90" text-anchor="middle" class="art__text" font-size="30" font-weight="800" fill="#f3e7d8">{{ soft?.value }}</text>
        <text x="212" y="110" text-anchor="middle" class="art__text" font-size="9" font-weight="700" letter-spacing="1.2" fill="#f3e7d8">{{ soft?.label.toUpperCase() }}</text>
      </g>
      <path d="M30 30 L38 22 M34 40 L46 36 M40 18 L42 8" stroke="#3b1f3a" stroke-width="3" stroke-linecap="round" />
      <path d="M278 30 L270 22 M274 40 L262 36 M268 18 L266 8" stroke="#3b1f3a" stroke-width="3" stroke-linecap="round" />
    </template>

    <!-- ¿Presente o pasado?: balanza entre una tele vieja y un celular -->
    <template v-else-if="kind === 'era'">
      <path d="M120 194 L188 194 L176 180 L132 180 Z" fill="#862c4d" />
      <rect x="150" y="68" width="8" height="114" fill="#862c4d" />
      <line x1="65" :y1="57.5 + tilt.left" x2="243" :y2="82.5 + tilt.right" stroke="#9d2d27" stroke-width="6" stroke-linecap="round" />
      <circle cx="154" cy="70" r="8" fill="#8aa63c" />
      <circle cx="154" cy="70" r="8" :fill="url('sheen')" />
      <!-- Antes -->
      <g :transform="`translate(0 ${tilt.left})`">
        <g stroke="#862c4d" stroke-width="1.5">
          <line x1="65" y1="57.5" x2="30" y2="102" /><line x1="65" y1="57.5" x2="100" y2="102" />
        </g>
        <path d="M28 102 Q65 126 102 102 Z" fill="#862c4d" />
        <line x1="65" y1="70" x2="54" y2="54" stroke="#862c4d" stroke-width="2.5" stroke-linecap="round" />
        <line x1="65" y1="70" x2="78" y2="56" stroke="#862c4d" stroke-width="2.5" stroke-linecap="round" />
        <rect x="40" y="68" width="50" height="36" rx="6" fill="#9d2d27" />
        <rect x="40" y="68" width="50" height="36" rx="6" :fill="url('leaf')" />
        <rect x="46" y="74" width="28" height="24" rx="5" fill="#54324d" />
        <path d="M50 80 Q60 76 70 80" fill="none" stroke="#862c4d" stroke-width="2" />
        <circle cx="82" cy="80" r="3" fill="#3b1f3a" />
        <circle cx="82" cy="91" r="3" fill="#3b1f3a" />
        <text
          x="65" y="146" text-anchor="middle" class="art__text" font-size="10" font-weight="700" letter-spacing="1.2"
          :fill="recentHeavy === false ? '#8aa63c' : '#f3e7d8'" :fill-opacity="recentHeavy === false ? 1 : 0.6"
        >ANTES</text>
      </g>
      <!-- Ahora -->
      <g :transform="`translate(0 ${tilt.right})`">
        <g stroke="#862c4d" stroke-width="1.5">
          <line x1="243" y1="82.5" x2="208" y2="127" /><line x1="243" y1="82.5" x2="278" y2="127" />
        </g>
        <path d="M206 127 Q243 151 280 127 Z" fill="#556a07" :filter="url('glit')" />
        <rect x="229" y="85" width="28" height="44" rx="6" fill="#9d2d27" />
        <rect x="229" y="85" width="28" height="44" rx="6" :fill="url('sheen')" />
        <rect x="232" y="91" width="22" height="30" rx="2" fill="#862c4d" />
        <polygon points="240,100 240,112 249,106" fill="#8aa63c" />
        <path d="M272 82 L274.5 88 L280 90 L274.5 92 L272 98 L269.5 92 L264 90 L269.5 88 Z" fill="#8aa63c" />
        <path d="M216 74 L217.6 78 L222 79.6 L217.6 81.2 L216 85.2 L214.4 81.2 L210 79.6 L214.4 78 Z" fill="#8aa63c" />
        <text
          x="243" y="170" text-anchor="middle" class="art__text" font-size="10" font-weight="700" letter-spacing="1.2"
          :fill="recentHeavy === false ? '#f3e7d8' : '#8aa63c'" :fill-opacity="recentHeavy === false ? 0.6 : 1"
        >AHORA</text>
      </g>
    </template>

    <!-- Explorador: mapa del tesoro con islas de géneros -->
    <template v-else-if="kind === 'explorer'">
      <path d="M22 22 Q90 14 154 22 T286 20 L288 188 Q220 196 154 188 T20 190 Z" fill="#54324d" stroke="#862c4d" stroke-width="2" />
      <g fill="none" stroke="#862c4d" stroke-width="1.5" stroke-linecap="round">
        <path d="M150 40 q5 -4 10 0 q5 4 10 0" /><path d="M60 120 q5 -4 10 0 q5 4 10 0" />
        <path d="M190 112 q5 -4 10 0 q5 4 10 0" /><path d="M250 176 q5 -4 10 0 q5 4 10 0" />
      </g>
      <path d="M50 74 C 46 54, 82 46, 104 56 C 118 64, 110 88, 86 90 C 66 92, 52 88, 50 74 Z" fill="#556a07" :filter="url('glit')" />
      <path d="M176 54 C 182 38, 228 36, 238 52 C 246 66, 226 80, 204 78 C 186 76, 172 66, 176 54 Z" fill="#862c4d" />
      <path d="M176 54 C 182 38, 228 36, 238 52 C 246 66, 226 80, 204 78 C 186 76, 172 66, 176 54 Z" :fill="url('leaf')" />
      <path d="M106 144 C 104 128, 140 122, 156 132 C 168 142, 154 160, 132 160 C 116 160, 108 154, 106 144 Z" fill="#9d2d27" />
      <path d="M106 144 C 104 128, 140 122, 156 132 C 168 142, 154 160, 132 160 C 116 160, 108 154, 106 144 Z" :fill="url('sheen')" />
      <path d="M216 140 C 216 126, 252 122, 262 134 C 270 146, 254 160, 236 158 C 222 156, 216 150, 216 140 Z" fill="#8aa63c" />
      <path d="M80 74 Q 140 34 204 60 Q 262 92 240 140 Q 196 182 134 146" fill="none" stroke="#f3e7d8" stroke-opacity="0.7" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round" />
      <path d="M126 138 L142 154 M142 138 L126 154" stroke="#f3e7d8" stroke-width="5" stroke-linecap="round" />
      <g class="art__text" font-size="9" font-weight="700" fill="#f3e7d8" fill-opacity="0.85" text-anchor="middle">
        <text v-for="l in islandLabels" :key="l.x" :x="l.x" :y="l.y">{{ l.text }}</text>
      </g>
      <circle cx="52" cy="160" r="17" fill="none" stroke="#862c4d" stroke-width="2" />
      <polygon points="52,145 56,160 52,175 48,160" fill="#3b1f3a" />
      <polygon points="52,145 56,160 48,160" fill="#9d2d27" />
      <text x="52" y="141" text-anchor="middle" class="art__text" font-size="8" font-weight="800" fill="#f3e7d8" fill-opacity="0.85">N</text>
    </template>

    <!-- Racha: llama sobre un bloque por semana -->
    <template v-else-if="kind === 'streak'">
      <path d="M154 22 C 178 54, 204 78, 200 122 C 196 158, 176 174, 154 174 C 132 174, 110 158, 108 124 C 106 98, 124 84, 132 58 C 140 76, 146 80, 154 22 Z" :fill="url('goldleaf')" />
      <path d="M156 76 C 172 98, 184 114, 180 140 C 176 160, 166 168, 154 168 C 142 168, 130 160, 128 142 C 126 124, 140 112, 144 96 C 148 106, 152 108, 156 76 Z" fill="#862c4d" :filter="url('glit')" />
      <ellipse cx="154" cy="148" rx="12" ry="16" fill="#d3bf46" />
      <ellipse cx="154" cy="148" rx="12" ry="16" :fill="url('sheen')" />
      <g fill="#556a07">
        <rect v-for="x in streakBlocks" :key="x" :x="x" y="180" width="22" height="14" rx="4" />
      </g>
      <g fill="#9d2d27">
        <circle cx="102" cy="64" r="4" /><circle cx="210" cy="52" r="3" />
        <circle cx="222" cy="92" r="4.5" /><circle cx="88" cy="110" r="3" />
      </g>
      <circle cx="194" cy="30" r="2.5" fill="#862c4d" />
      <circle cx="118" cy="34" r="2" fill="#862c4d" />
    </template>

    <!-- Eres de martes: la semana en fila, el día fuerte grande y con corona -->
    <template v-else-if="kind === 'weekday'">
      <line x1="16" y1="168" x2="292" y2="168" stroke="#3b1f3a" stroke-opacity="0.5" stroke-width="2" stroke-linecap="round" />
      <template v-for="c in weekCircles" :key="c.initial">
        <template v-if="!c.big">
          <circle :cx="c.cx" cy="140" r="14" fill="#3b1f3a" />
          <text :x="c.cx" y="144.5" text-anchor="middle" class="art__text" font-size="12" font-weight="700" fill="#f3e7d8" fill-opacity="0.7">{{ c.initial }}</text>
        </template>
      </template>
      <g :transform="`translate(${crownX} 0)`">
        <circle cx="88" cy="120" r="36" fill="#556a07" />
        <circle cx="88" cy="120" r="36" :fill="url('leaf')" />
        <text x="88" y="132" text-anchor="middle" class="art__text" font-size="34" font-weight="800" fill="#f3e7d8">
          {{ weekCircles.find((c) => c.big)?.initial }}
        </text>
        <polygon points="64,78 64,52 76,64 88,42 100,64 112,52 112,78" fill="#d3bf46" :filter="url('glit')" />
        <rect x="64" y="74" width="48" height="6" rx="2" fill="#d3bf46" />
        <rect x="64" y="74" width="48" height="6" rx="2" :fill="url('sheen')" />
        <circle cx="76" cy="71" r="3" fill="#862c4d" />
        <circle cx="88" cy="69" r="3.5" fill="#9d2d27" />
        <circle cx="100" cy="71" r="3" fill="#862c4d" />
      </g>
      <g fill="#3b1f3a">
        <rect x="134" y="44" width="8" height="4" rx="2" transform="rotate(30 138 46)" />
        <rect x="40" y="56" width="8" height="4" rx="2" transform="rotate(-25 44 58)" />
        <rect x="128" y="88" width="6" height="3" rx="1.5" transform="rotate(-40 131 89)" />
      </g>
      <g fill="#8aa63c">
        <circle cx="140" cy="70" r="2.5" /><circle cx="36" cy="92" r="2" /><circle cx="58" cy="34" r="2" />
      </g>
      <path d="M124 32 L126.5 38 L132 40 L126.5 42 L124 48 L121.5 42 L116 40 L121.5 38 Z" fill="#3b1f3a" />
    </template>

    <!-- Pila de pendientes: torre tambaleante de obras -->
    <template v-else-if="kind === 'backlog'">
      <ellipse cx="154" cy="200" rx="84" ry="6" fill="#000000" fill-opacity="0.25" />
      <rect x="88" y="174" width="132" height="24" rx="3" fill="#862c4d" />
      <rect x="88" y="174" width="132" height="24" rx="3" :fill="url('leaf')" />
      <rect x="88" y="174" width="10" height="24" fill="#54324d" />
      <line x1="108" y1="186" x2="200" y2="186" stroke="#f3e7d8" stroke-opacity="0.35" stroke-width="2" />
      <g transform="rotate(-3 154 162)">
        <rect x="98" y="151" width="112" height="22" rx="3" fill="#556a07" />
        <rect x="196" y="151" width="8" height="22" fill="#3b1f3a" fill-opacity="0.4" />
      </g>
      <g transform="rotate(2 156 139)">
        <rect x="106" y="127" width="100" height="24" rx="4" fill="#9d2d27" />
        <rect x="106" y="127" width="100" height="24" rx="4" :fill="url('sheen')" />
        <rect x="106" y="127" width="22" height="24" rx="4" fill="#54324d" />
        <circle cx="117" cy="139" r="5" fill="#8aa63c" />
        <rect x="138" y="135" width="48" height="4" rx="2" fill="#f3e7d8" fill-opacity="0.45" />
        <rect x="138" y="142" width="30" height="3" rx="1.5" fill="#f3e7d8" fill-opacity="0.25" />
      </g>
      <g transform="rotate(5 160 114)">
        <rect x="98" y="103" width="124" height="22" rx="3" fill="#8aa63c" />
        <rect x="98" y="103" width="8" height="22" fill="#556a07" />
        <line x1="116" y1="114" x2="190" y2="114" stroke="#3b1f3a" stroke-opacity="0.4" stroke-width="2" />
      </g>
      <g transform="rotate(-2 164 92)">
        <circle cx="164" cy="92" r="18" fill="#862c4d" :filter="url('glit')" />
        <circle cx="164" cy="92" r="12" fill="none" stroke="#3b1f3a" stroke-opacity="0.35" stroke-width="1.5" />
        <circle cx="164" cy="92" r="6" fill="#9d2d27" />
        <circle cx="164" cy="92" r="1.6" fill="#3b1f3a" />
      </g>
      <g transform="rotate(-9 150 58)">
        <rect x="116" y="56" width="70" height="20" rx="3" fill="#556a07" />
        <rect x="116" y="44" width="70" height="10" rx="2" fill="#8aa63c" />
        <polygon points="124,44 134,44 128,54 118,54" fill="#3b1f3a" />
        <polygon points="144,44 154,44 148,54 138,54" fill="#3b1f3a" />
        <polygon points="164,44 174,44 168,54 158,54" fill="#3b1f3a" />
        <line x1="124" y1="66" x2="168" y2="66" stroke="#3b1f3a" stroke-opacity="0.5" stroke-width="2" />
      </g>
      <g fill="none" stroke="#862c4d" stroke-width="3" stroke-linecap="round">
        <path d="M212 52 Q 222 64 214 78" /><path d="M224 44 Q 238 62 226 84" />
        <path d="M98 64 Q 88 76 96 90" />
      </g>
      <path d="M248 40 C 248 52, 238 54, 238 46 C 238 42, 244 36, 248 28 Z" fill="#8aa63c" transform="rotate(20 243 40)" />
    </template>

    <!-- Constancia: montaña con sendero; el escalador sube según el % -->
    <template v-else-if="kind === 'constancy'">
      <circle cx="250" cy="46" r="20" fill="#9d2d27" :filter="url('glit')" />
      <polygon points="150,210 232,92 308,210" fill="#556a07" />
      <polygon points="150,210 232,92 308,210" :fill="url('leaf')" />
      <polygon points="0,210 130,40 178,104 206,74 290,210" fill="#3b1f3a" />
      <polygon points="130,40 110,66 122,62 132,72 142,60 150,66" fill="#54324d" />
      <path :d="trailPath" fill="none" stroke="#8aa63c" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" stroke-linejoin="round" />
      <line x1="130" y1="40" x2="130" y2="12" stroke="#3b1f3a" stroke-width="3" stroke-linecap="round" />
      <polygon points="131,12 156,18 131,26" fill="#8aa63c" />
      <polygon points="131,12 156,18 131,26" :fill="url('sheen')" />
      <circle :cx="climber.x" :cy="climber.y" r="7" fill="#8aa63c" stroke="#3b1f3a" stroke-width="2" />
      <rect x="18" y="186" width="34" height="18" rx="9" fill="#862c4d" />
      <text x="35" y="199" text-anchor="middle" class="art__text" font-size="10" font-weight="800" fill="#f3e7d8">0%</text>
      <rect x="162" y="24" width="40" height="18" rx="9" fill="#3b1f3a" />
      <text x="182" y="37" text-anchor="middle" class="art__text" font-size="10" font-weight="800" fill="#8aa63c">100%</text>
    </template>

    <!-- Calificaciones: salero que espolvorea estrellas -->
    <template v-else-if="kind === 'ratings'">
      <g transform="rotate(-135 211 64)">
        <rect x="188" y="40" width="46" height="66" rx="10" fill="#9d2d27" />
        <rect x="188" y="40" width="46" height="66" rx="10" :fill="url('leaf')" />
        <rect x="188" y="64" width="46" height="20" fill="#862c4d" />
        <path d="M211 67 L213.1 72.4 L218.6 72.5 L214.2 75.9 L215.9 81.4 L211 78.2 L206.1 81.4 L207.8 75.9 L203.4 72.5 L208.9 72.4 Z" fill="#8aa63c" />
        <rect x="184" y="22" width="54" height="22" rx="7" fill="#556a07" />
        <rect x="184" y="22" width="54" height="22" rx="7" :fill="url('sheen')" />
        <g fill="#3b1f3a">
          <circle cx="200" cy="29" r="2" /><circle cx="211" cy="29" r="2" /><circle cx="222" cy="29" r="2" />
          <circle cx="205.5" cy="36" r="2" /><circle cx="216.5" cy="36" r="2" />
        </g>
      </g>
      <path
        v-for="s in [[172, 108, 0.7, '#8aa63c'], [154, 124, 0.9, '#c0453c'], [174, 136, 0.55, '#862c4d'], [138, 146, 0.75, '#8aa63c'], [124, 126, 0.5, '#c0453c']]"
        :key="`${s[0]}-${s[1]}`" :d="STAR" :fill="String(s[3])" :transform="`translate(${s[0]} ${s[1]}) scale(${s[2]})`"
      />
      <path
        v-for="s in [[64, 190, 1.15, -12, '#c0453c'], [88, 188, 1.25, 8, '#8aa63c'], [113, 192, 1.05, -20, '#862c4d'], [136, 194, 0.8, 15, '#c0453c'], [101, 170, 1.1, -6, '#c0453c'], [124, 176, 0.85, 24, '#8aa63c'], [88, 153, 0.95, -14, '#862c4d']]"
        :key="`${s[0]}-${s[1]}`" :d="STAR" :fill="String(s[4])" :filter="url('glit')"
        :transform="`translate(${s[0]} ${s[1]}) scale(${s[2]}) rotate(${s[3]})`"
      />
      <path :d="STAR" fill="#d3bf46" transform="translate(76 170) rotate(18)" />
      <path :d="STAR" :fill="url('sheen')" transform="translate(76 170) rotate(18)" />
    </template>

    <!-- Día más intenso: hoja de calendario que estalla -->
    <template v-else-if="kind === 'day'">
      <g stroke="#3b1f3a" stroke-opacity="0.6" stroke-width="3" stroke-linecap="round">
        <line x1="154" y1="50" x2="154" y2="34" /><line x1="200" y1="68" x2="212" y2="56" />
        <line x1="220" y1="115" x2="236" y2="115" /><line x1="200" y1="162" x2="212" y2="174" />
        <line x1="108" y1="162" x2="96" y2="174" /><line x1="88" y1="115" x2="72" y2="115" />
        <line x1="108" y1="68" x2="96" y2="56" />
      </g>
      <rect x="114" y="66" width="80" height="96" rx="8" fill="#3b1f3a" />
      <template v-for="fill in ['#9d2d27', url('leaf')]" :key="fill">
        <rect x="114" y="66" width="80" height="26" rx="8" :fill="fill" />
        <rect x="114" y="80" width="80" height="12" :fill="fill" />
      </template>
      <template v-for="x in [132, 170]" :key="x">
        <rect :x="x" y="60" width="6" height="14" rx="3" fill="#8aa63c" />
        <rect :x="x" y="60" width="6" height="14" rx="3" :fill="url('sheen')" />
      </template>
      <text x="154" y="86" text-anchor="middle" class="art__text" font-size="12" font-weight="700" letter-spacing="1.5" fill="#f3e7d8">{{ month }}</text>
      <text x="154" y="142" text-anchor="middle" class="art__text" font-size="42" font-weight="800" fill="#f3e7d8">{{ day }}</text>
      <g transform="translate(30 32) rotate(-10 18 18)" :filter="url('glit')">
        <rect x="0" y="12" width="40" height="26" rx="3" fill="#556a07" />
        <rect x="0" y="2" width="40" height="9" rx="2" fill="#8aa63c" />
        <polygon points="6,2 13,2 9,11 2,11" fill="#3b1f3a" />
        <polygon points="20,2 27,2 23,11 16,11" fill="#3b1f3a" />
        <polygon points="34,2 40,2 37,11 30,11" fill="#3b1f3a" />
      </g>
      <g transform="translate(240 28) rotate(12 16 20)">
        <rect x="0" y="0" width="32" height="40" rx="3" fill="#3b1f3a" />
        <rect x="0" y="0" width="7" height="40" fill="#556a07" />
        <rect x="12" y="10" width="14" height="3" rx="1.5" fill="#f3e7d8" fill-opacity="0.7" />
        <rect x="12" y="16" width="10" height="3" rx="1.5" fill="#f3e7d8" fill-opacity="0.4" />
      </g>
      <g transform="translate(24 150) rotate(8 24 12)">
        <rect x="0" y="0" width="50" height="26" rx="13" fill="#556a07" />
        <rect x="0" y="0" width="50" height="26" rx="13" :fill="url('leaf')" />
        <rect x="9" y="11" width="12" height="4" rx="1" fill="#3b1f3a" />
        <rect x="13" y="7" width="4" height="12" rx="1" fill="#3b1f3a" />
        <circle cx="35" cy="10" r="3" fill="#8aa63c" />
        <circle cx="41" cy="16" r="3" fill="#9d2d27" />
      </g>
      <g transform="translate(246 142) rotate(-10 14 20)" fill="#3b1f3a">
        <ellipse cx="8" cy="34" rx="9" ry="7" />
        <rect x="13" y="2" width="4" height="32" />
        <path d="M17 2 C 26 6, 30 12, 28 22 C 26 16, 22 13, 17 12 Z" />
      </g>
      <g fill="#8aa63c">
        <circle cx="232" cy="88" r="3" /><circle cx="80" cy="88" r="2.5" /><circle cx="226" cy="146" r="2" />
      </g>
    </template>
  </svg>
</template>

<style scoped>
.art {
  display: block;
  width: 100%;
  height: 100%;
}

.art--image {
  position: relative;
}

.art__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.art__svg {
  display: block;
  width: 100%;
  height: 100%;
}

.art--image .art__svg {
  position: absolute;
  inset: 0;
}

.art__text {
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
</style>
