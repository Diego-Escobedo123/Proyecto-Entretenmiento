<script setup lang="ts">
/**
 * ProfileInsights — banco de insights del perfil: se calculan todos los que
 * tengan datos y se muestran los 4 más llamativos, así cada perfil cuenta
 * algo distinto. Cada uno es una carta ilustrada (InsightCard + InsightArt):
 * al frente el dato, al reverso la frase; se voltea al tocarla.
 *
 * Banco:
 *   against     Contra la corriente: su nota vs. la de Mosaic.  (servidor)
 *   speed       Velocidad: cuánto tarda en terminar algo.        (servidor)
 *   timeTravel  Viaje en el tiempo: la obra más vieja que vio.   (servidor)
 *   constancy   Constancia: qué parte de lo que empieza termina.
 *   ratings     Calificaciones: cuántas de sus notas son de 4★ o más.
 *   day         Su día más intenso del último año.
 *   rewatch     Vuelves a…: la obra que más veces terminó.           (servidor)
 *   affinity    Afinidad: con quién de los que sigue comparte más.   (servidor)
 *   harsher     Más exigente con…: su tipo peor calificado.          (servidor)
 *   era         ¿Presente o pasado?: cuánto de lo que ve es reciente. (servidor)
 *   explorer    Explorador: cuántos géneros cruza.                   (servidor)
 *   backlog     Su pila de pendientes: meses para vaciar la wishlist. (servidor)
 *   streak      Racha: más semanas seguidas con registros.
 *   weekday     Eres de martes: el día de la semana con más registros.
 *
 * Se adapta al ancho del contenedor (container queries de `.ov`, en DnaOverview):
 * en angosto las cartas se deslizan de lado; desde 400px van las cuatro en fila.
 */
import { computed } from 'vue'
import InsightArt from './InsightArt.vue'
import InsightCard from './InsightCard.vue'
import { typeMeta } from '../../lib/catalog'
import { parseISODay } from '../../lib/dates'
import type { ActivityEvent, ProfileInsightsData, PublicProfile } from '../../types/review'
import type { MediaType } from '../../types/media'

const props = defineProps<{
  dna: PublicProfile['dna']
  ratings: PublicProfile['ratings']
  activity: ActivityEvent[]
  lastAbandoned: string | null
  insights: ProfileInsightsData | null
  self?: boolean
}>()

/** Verbo en 2.ª persona (self) o 3.ª: v('completas', 'completa'). */
const v = (tu: string, el: string) => (props.self ? tu : el)

const decimal = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** "1 día" / "3 días". */
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** Registros mínimos y parte mínima para "Eres de martes". */
const MIN_WEEKDAY_EVENTS = 5
const MIN_WEEKDAY_SHARE = 0.3
/** Semanas seguidas mínimas para "Racha". */
const MIN_STREAK = 3

const NUMBER_WORDS = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco']

/** "una serie", "dos películas", "un álbum"… */
function countType(type: MediaType, n: number): string {
  const meta = typeMeta(type)
  if (n === 1) return `${meta.gender === 'f' ? 'una' : 'un'} ${meta.label.toLowerCase()}`
  return `${NUMBER_WORDS[n] ?? n} ${meta.plural.toLowerCase()}`
}

function joinList(items: string[]): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

/** "la"/"lo" según el tipo de obra (la película, el libro). */
const pronoun = (type: MediaType) => (typeMeta(type).gender === 'f' ? 'la' : 'lo')

/** "viste"/"vio", "leíste"/"leyó"… */
const SEEN: Record<MediaType, [string, string]> = {
  movie: ['viste', 'vio'],
  series: ['viste', 'vio'],
  book: ['leíste', 'leyó'],
  game: ['jugaste', 'jugó'],
  music: ['escuchaste', 'escuchó'],
}

/** Chip de "Vuelves a…" según el tipo. */
const REPEATS: Record<MediaType, string> = {
  movie: 'Vistas',
  series: 'Vistas',
  book: 'Lecturas',
  game: 'Partidas',
  music: 'Escuchas',
}

// --- Contra la corriente ---
const against = computed(() => {
  const a = props.insights?.against
  if (!a) return null
  const gap = a.rating - a.community
  return {
    ...a,
    gap,
    // Sin adjetivos con género: no sabemos el de la persona.
    verdict: props.self
      ? `Nadie ${pronoun(a.type)} ${gap > 0 ? 'defiende' : 'castiga'} como tú.`
      : `Pocos ${pronoun(a.type)} ${gap > 0 ? 'defienden' : 'castigan'} tanto.`,
  }
})

// --- Velocidad ---
const speed = computed(() => {
  const s = props.insights?.speed
  if (!s) return null
  return {
    ...s,
    recordDays: s.fastest.days === 1 ? 'un solo día' : `${s.fastest.days} días`,
  }
})

// --- Viaje en el tiempo ---
const timeTravel = computed(() => {
  const t = props.insights?.timeTravel
  if (!t) return null
  const [tu, el] = SEEN[t.type]
  return { ...t, seen: capitalize(`${pronoun(t.type)} ${v(tu, el)}`) }
})

// --- Constancia ---
const hasCollection = computed(() => props.dna.dominantType != null)
const completion = computed(() => props.dna.completionRate)

// --- Calificaciones (histograma de ½ a 5; índices 7–9 = 4, 4½ y 5) ---
const highRatings = computed(() => props.ratings.histogram.slice(7).reduce((a, b) => a + b, 0))
/** Veredicto en tres partes para resaltar el centro: [antes, resaltado, después]. */
const ratingVerdict = computed<[string, string, string]>(() => {
  const share = highRatings.value / props.ratings.count
  if (share >= 0.7) return [`${v('Eres', 'Es')} de `, 'mano generosa', '.']
  if (share <= 0.3) return [`${v('Eres', 'Es')} de `, 'estrellas difíciles', '.']
  return [`${v('Repartes', 'Reparte')} las estrellas con `, 'equilibrio', '.']
})

// --- Día más intenso ---
const busiestDay = computed(() => {
  const byDay = new Map<string, Map<string, MediaType>>()
  for (const e of props.activity) {
    const works = byDay.get(e.date) ?? new Map<string, MediaType>()
    works.set(e.title, e.type)
    byDay.set(e.date, works)
  }
  // El que tenga más obras distintas; si empatan, el más reciente.
  const [date, works] =
    [...byDay.entries()].sort((a, b) => b[1].size - a[1].size || b[0].localeCompare(a[0]))[0] ?? []
  if (!date || !works) return null

  const byType = new Map<MediaType, number>()
  for (const type of works.values()) byType.set(type, (byType.get(type) ?? 0) + 1)
  const d = parseISODay(date)
  const month = d.toLocaleDateString('es', { month: 'short' }).replace('.', '').slice(0, 3)
  return {
    month,
    monthLong: d.toLocaleDateString('es', { month: 'long' }),
    day: d.getDate(),
    count: works.size,
    detail: joinList([...byType.entries()].map(([type, n]) => countType(type, n))),
  }
})

// --- Vuelves a… ---
const rewatch = computed(() => {
  const r = props.insights?.rewatch
  if (!r) return null
  const [tu, el] = SEEN[r.type]
  return { ...r, seen: capitalize(v(tu, el)), chip: REPEATS[r.type] }
})

// --- Más exigente con… ---
const harsher = computed(() => {
  const h = props.insights?.harsherWith
  if (!h) return null
  const strict = typeMeta(h.strict.type)
  const soft = typeMeta(h.soft.type)
  return {
    ...h,
    strictLabel: strict.plural,
    strictArticle: strict.gender === 'f' ? 'las' : 'los',
    softLabel: `${soft.gender === 'f' ? 'las' : 'los'} ${soft.plural.toLowerCase()}`,
    softPlural: soft.plural,
  }
})

// --- ¿Presente o pasado? ---
const era = computed(() => {
  const e = props.insights?.era
  if (!e) return null
  const verdict: [string, string, string] =
    e.recentPercent >= 65
      ? [`${v('Vives', 'Vive')} en el `, 'presente', '.']
      : e.recentPercent <= 25
        ? [`Lo ${v('tuyo', 'suyo')} son los `, 'clásicos', '.']
        : [`${v('Mezclas', 'Mezcla')} `, 'estrenos y clásicos', '.']
  return { ...e, verdict, extreme: e.recentPercent >= 65 || e.recentPercent <= 25 }
})

// --- Explorador ---
const explorer = computed(() => {
  const x = props.insights?.explorer
  if (!x) return null
  const fresh = x.newThisYear.slice(0, 2).map((g) => g.toLowerCase())
  const islands = [...new Set([...x.newThisYear, ...props.dna.topGenres.map((g) => g.name)])].slice(0, 4)
  return { ...x, fresh, more: x.newThisYear.length > 2, top: props.dna.topGenres[0]?.name ?? null, islands }
})

// --- Tu pila de pendientes ---
const backlog = computed(() => props.insights?.backlog ?? null)

// --- Afinidad ---
const affinity = computed(() => {
  const a = props.insights?.affinity
  if (!a) return null
  const notes =
    a.ratingGap == null
      ? ''
      : a.ratingGap <= 0.5
        ? 'Y casi siempre coinciden en las notas.'
        : a.ratingGap >= 1.5
          ? 'Aunque rara vez coinciden en las notas.'
          : 'Y sus notas se parecen bastante.'
  return { ...a, notes }
})

// --- Eres de martes: el día de la semana con más registros ---
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
/** Lunes primero, como en el calendario de acá. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const weekday = computed(() => {
  if (props.activity.length < MIN_WEEKDAY_EVENTS) return null
  const counts = Array.from({ length: 7 }, () => 0)
  for (const e of props.activity) counts[parseISODay(e.date).getDay()]++
  const top = counts.indexOf(Math.max(...counts))
  const share = counts[top] / props.activity.length
  if (share < MIN_WEEKDAY_SHARE) return null
  const name = WEEKDAYS[top]
  return {
    name,
    plural: name.endsWith('s') ? name : `${name}s`,
    percent: Math.round(share * 100),
    /** Posición en la semana que empieza en lunes. */
    position: WEEK_ORDER.indexOf(top),
  }
})

// --- Racha: más semanas seguidas con algún registro ---
const WEEK = 7 * 86_400_000
const streak = computed(() => {
  /** Semana (de domingo a sábado) de cada registro, como número. */
  const weekOf = (date: string) => {
    const d = parseISODay(date)
    d.setDate(d.getDate() - d.getDay())
    return Math.round(d.getTime() / WEEK)
  }
  const weeks = [...new Set(props.activity.map((e) => weekOf(e.date)))].sort((a, b) => a - b)
  let best = { length: 0, start: 0 }
  let run = { length: 0, start: 0 }
  weeks.forEach((w, i) => {
    run = i > 0 && w === weeks[i - 1] + 1 ? { length: run.length + 1, start: run.start } : { length: 1, start: w }
    if (run.length >= best.length) best = run
  })
  if (best.length < MIN_STREAK) return null
  const month = (week: number) => new Date(week * WEEK).toLocaleDateString('es', { month: 'long' })
  const from = month(best.start)
  const to = month(best.start + best.length - 1)
  return { weeks: best.length, when: from === to ? `en ${from}` : `de ${from} a ${to}` }
})

// --- El banco: puntaje = qué tan llamativo es; se muestran los 4 mejores ---
type InsightKey =
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

const shown = computed<InsightKey[]>(() => {
  const candidates: { key: InsightKey; score: number }[] = []
  if (against.value) candidates.push({ key: 'against', score: 5 + Math.abs(against.value.gap) })
  if (speed.value) candidates.push({ key: 'speed', score: 3.5 })
  if (timeTravel.value) candidates.push({ key: 'timeTravel', score: 3 + timeTravel.value.years / 25 })
  if (rewatch.value) candidates.push({ key: 'rewatch', score: 3 + rewatch.value.times * 0.3 })
  if (affinity.value) candidates.push({ key: 'affinity', score: 2.5 + affinity.value.shared / 10 })
  if (harsher.value) candidates.push({ key: 'harsher', score: 2 + (harsher.value.soft.average - harsher.value.strict.average) })
  if (streak.value) candidates.push({ key: 'streak', score: 2 + streak.value.weeks / 8 })
  if (era.value) candidates.push({ key: 'era', score: era.value.extreme ? 2.4 : 1.2 })
  if (explorer.value) {
    candidates.push({ key: 'explorer', score: 1.6 + Math.min(1, explorer.value.genres / 20) + explorer.value.newThisYear.length * 0.3 })
  }
  if (weekday.value) candidates.push({ key: 'weekday', score: 1.5 + weekday.value.percent / 50 })
  if (backlog.value) candidates.push({ key: 'backlog', score: 1.4 })
  if (hasCollection.value) {
    const extreme = completion.value >= 90 || completion.value <= 30
    candidates.push({ key: 'constancy', score: extreme ? 3 : 2 })
  }
  if (busiestDay.value) {
    candidates.push({ key: 'day', score: busiestDay.value.count >= 3 ? 2.5 : busiestDay.value.count === 2 ? 1.5 : 0.5 })
  }
  if (props.ratings.count) candidates.push({ key: 'ratings', score: props.ratings.count >= 3 ? 1.8 : 1 })
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((c) => c.key)
})
</script>

<template>
  <template v-if="shown.length">
    <h3 class="insights__title">Insights</h3>
    <div class="insights">
      <template v-for="key in shown" :key="key">
        <!-- Contra la corriente -->
        <InsightCard
          v-if="key === 'against' && against"
          title="Contra la corriente"
          label="Puntos"
          :value="`${against.gap > 0 ? '+' : '−'}${decimal(Math.abs(against.gap))}`"
          star
        >
          <template #art>
            <InsightArt kind="against" label="Un pez verde con una estrella nada contra la corriente mientras los demás van en sentido contrario" />
          </template>
          {{ v('Le diste', 'Le dio') }} <em>{{ decimal(against.rating) }}★</em> a <em>{{ against.title }}</em>.<br />
          Mosaic le da <em>{{ decimal(against.community) }}</em>.<br />
          {{ against.verdict }}
        </InsightCard>

        <!-- Velocidad -->
        <InsightCard
          v-else-if="key === 'speed' && speed"
          title="Velocidad"
          label="Promedio"
          :value="speed.averageDays"
          :unit="plural(speed.averageDays, 'día', 'días')"
          art-bg="raspberry"
        >
          <template #art>
            <InsightArt kind="speed" label="Un reloj de arena que sale disparado, con líneas de velocidad detrás" />
          </template>
          <template v-if="speed.type">
            {{ capitalize(countType(speed.type, 1)) }} {{ v('te', 'le') }} dura
            <em>{{ speed.averageDays }} {{ plural(speed.averageDays, 'día', 'días') }}</em> en promedio.<br />
          </template>
          <template v-else>
            {{ v('Tardas', 'Tarda') }} <em>{{ speed.averageDays }} {{ plural(speed.averageDays, 'día', 'días') }}</em>
            en promedio en terminar algo.<br />
          </template>
          {{ v('Tu', 'Su') }} récord: <em>{{ speed.fastest.title }}</em>, en <em>{{ speed.recordDays }}</em>.
        </InsightCard>

        <!-- Viaje en el tiempo -->
        <InsightCard
          v-else-if="key === 'timeTravel' && timeTravel"
          title="Viaje en el tiempo"
          label="Distancia"
          :value="timeTravel.years"
          :unit="plural(timeTravel.years, 'año', 'años')"
        >
          <template #art>
            <InsightArt
              kind="timeTravel"
              :year="timeTravel.year"
              :seen-year="timeTravel.seenYear"
              :label="`Un portal en espiral con forma de reloj del que sale un camino de ${timeTravel.year} a ${timeTravel.seenYear}`"
            />
          </template>
          <em>{{ timeTravel.title }}</em> es de <em>{{ timeTravel.year }}</em>.<br />
          {{ timeTravel.seen }} <em>{{ timeTravel.years }} {{ plural(timeTravel.years, 'año', 'años') }}</em> después.
        </InsightCard>

        <!-- Vuelves a… -->
        <InsightCard
          v-else-if="key === 'rewatch' && rewatch"
          :title="v('Vuelves a…', 'Vuelve a…')"
          :label="rewatch.chip"
          :value="`×${rewatch.times}`"
        >
          <template #art>
            <InsightArt kind="rewatch" :times="rewatch.times" label="Un casete rodeado por una flecha circular de repetición" />
          </template>
          {{ rewatch.seen }} <em>{{ rewatch.title }}</em> <em>{{ rewatch.times }} veces</em>.<br />
          Ya es parte de {{ v('ti', 'su historia') }}.
        </InsightCard>

        <!-- Afinidad -->
        <InsightCard
          v-else-if="key === 'affinity' && affinity"
          title="Afinidad"
          label="En común"
          :value="affinity.shared"
          :unit="plural(affinity.shared, 'obra', 'obras')"
        >
          <template #art>
            <InsightArt kind="affinity" label="Dos personas comparten un balde de palomitas, con corazones encima" />
          </template>
          {{ v('Compartes', 'Comparte') }} <em>{{ affinity.shared }} {{ plural(affinity.shared, 'obra', 'obras') }}</em>
          con <em>{{ affinity.name }}</em>.<template v-if="affinity.notes"><br />{{ affinity.notes }}</template>
        </InsightCard>

        <!-- Más exigente con… -->
        <InsightCard
          v-else-if="key === 'harsher' && harsher"
          title="Más exigente con…"
          :label="harsher.strictLabel"
          :value="decimal(harsher.strict.average)"
          star
          art-bg="raspberry"
        >
          <template #art>
            <InsightArt
              kind="harsher"
              :strict="{ value: decimal(harsher.strict.average), label: harsher.strictLabel }"
              :soft="{ value: decimal(harsher.soft.average), label: harsher.softPlural }"
              :label="`Dos paletas de jurado: ${decimal(harsher.strict.average)} para ${harsher.strictLabel.toLowerCase()} y ${decimal(harsher.soft.average)} para ${harsher.softPlural.toLowerCase()}`"
            />
          </template>
          {{ v('Eres', 'Es') }} más exigente con {{ harsher.strictArticle }}
          <em>{{ harsher.strictLabel.toLowerCase() }}</em>: <em>{{ decimal(harsher.strict.average) }}★</em> en promedio,
          contra {{ decimal(harsher.soft.average) }}★ a {{ harsher.softLabel }}.
        </InsightCard>

        <!-- ¿Presente o pasado? -->
        <InsightCard
          v-else-if="key === 'era' && era"
          title="¿Presente o pasado?"
          label="Recientes"
          :value="era.recentPercent"
          unit="%"
        >
          <template #art>
            <InsightArt
              kind="era"
              :recent-heavy="era.recentPercent >= 50"
              :label="`Una balanza con una tele antigua de un lado y un celular del otro; pesa más ${era.recentPercent >= 50 ? 'el celular' : 'la tele'}`"
            />
          </template>
          El <em>{{ era.recentPercent }}%</em> de lo que {{ v('registras', 'registra') }} salió en los últimos
          {{ era.recentYears }} años.<br />
          {{ era.verdict[0] }}<em>{{ era.verdict[1] }}</em>{{ era.verdict[2] }}
        </InsightCard>

        <!-- Explorador -->
        <InsightCard
          v-else-if="key === 'explorer' && explorer"
          title="Explorador"
          label="Géneros"
          :value="explorer.genres"
        >
          <template #art>
            <InsightArt
              kind="explorer"
              :genres="explorer.islands"
              label="Un mapa del tesoro con islas de géneros unidas por un camino punteado que termina en una X"
            />
          </template>
          <em>{{ explorer.genres }} {{ plural(explorer.genres, 'género', 'géneros') }}</em>
          {{ plural(explorer.genres, 'cruza', 'cruzan') }} {{ v('tu', 'su') }} colección.
          <template v-if="explorer.fresh.length">
            <br />Este año {{ v('sumaste', 'sumó') }}
            <template v-for="(g, i) in explorer.fresh" :key="g">
              {{ i === 0 ? '' : explorer.fresh.length === 2 && !explorer.more ? ' y ' : ', ' }}<em>{{ g }}</em>
            </template>{{ explorer.more ? ' y más' : '' }}.
          </template>
          <template v-else-if="explorer.top"><br /><em>{{ explorer.top }}</em> va a la cabeza.</template>
        </InsightCard>

        <!-- Racha -->
        <InsightCard
          v-else-if="key === 'streak' && streak"
          title="Racha"
          label="Seguidas"
          :value="streak.weeks"
          unit="semanas"
        >
          <template #art>
            <InsightArt
              kind="streak"
              :weeks="streak.weeks"
              :label="`Una llama encendida sobre bloques, uno por cada semana de la racha`"
            />
          </template>
          <em>{{ streak.weeks }} semanas</em> seguidas registrando algo, {{ streak.when }}.
        </InsightCard>

        <!-- Eres de martes -->
        <InsightCard
          v-else-if="key === 'weekday' && weekday"
          :title="`${v('Eres', 'Es')} de ${weekday.plural}`"
          :label="capitalize(weekday.name)"
          :value="weekday.percent"
          unit="%"
          art-bg="raspberry"
        >
          <template #art>
            <InsightArt
              kind="weekday"
              :top-day="weekday.position"
              :label="`Los siete días de la semana en fila; el ${weekday.name} es enorme, verde y lleva corona`"
            />
          </template>
          El <em>{{ weekday.percent }}%</em> de {{ v('tus', 'sus') }} registros cae en <em>{{ weekday.name }}</em>.
        </InsightCard>

        <!-- Pila de pendientes -->
        <InsightCard
          v-else-if="key === 'backlog' && backlog"
          :title="`${v('Tu', 'Su')} pila de pendientes`"
          label="Wishlist"
          :value="backlog.months ?? backlog.pending"
          :unit="backlog.months ? plural(backlog.months, 'mes', 'meses') : plural(backlog.pending, 'obra', 'obras')"
        >
          <template #art>
            <InsightArt kind="backlog" label="Una torre tambaleante de libros, un juego, un disco y una claqueta" />
          </template>
          <template v-if="backlog.months">
            {{ v('Tu', 'Su') }} wishlist tiene <em>{{ backlog.pending }} {{ plural(backlog.pending, 'obra', 'obras') }}</em>.<br />
            Al ritmo del último año, la {{ v('vacías', 'vacía') }} en
            <em>{{ backlog.months }} {{ plural(backlog.months, 'mes', 'meses') }}</em>.
          </template>
          <template v-else>
            <em>{{ backlog.pending }} {{ plural(backlog.pending, 'obra', 'obras') }}</em>
            {{ plural(backlog.pending, 'espera', 'esperan') }} su turno en {{ v('tu', 'su') }} wishlist.
          </template>
        </InsightCard>

        <!-- Constancia -->
        <InsightCard
          v-else-if="key === 'constancy'"
          title="Constancia"
          :label="v('Terminas', 'Termina')"
          :value="completion"
          unit="%"
          art-bg="raspberry"
        >
          <template #art>
            <InsightArt
              kind="constancy"
              :progress="completion"
              :label="`Una montaña con un sendero punteado; el escalador va por el ${completion}% del camino a la cima`"
            />
          </template>
          {{ v('Terminas', 'Termina') }} el <em>{{ completion }}%</em> de lo que {{ v('empiezas', 'empieza') }}.
          <template v-if="lastAbandoned"><br />Último abandono: <em>{{ lastAbandoned }}</em>.</template>
        </InsightCard>

        <!-- Calificaciones -->
        <InsightCard
          v-else-if="key === 'ratings'"
          title="Calificaciones"
          label="4★ o más"
          :value="highRatings"
          :unit="`/${ratings.count}`"
        >
          <template #art>
            <InsightArt kind="ratings" label="Un salero inclinado que espolvorea estrellas sobre una pila de estrellas" />
          </template>
          <template v-if="ratings.count === 1">
            {{ v('Tu', 'Su') }} única nota es de <em>{{ highRatings ? '4★ o más' : 'menos de 4★' }}</em>.
          </template>
          <template v-else>
            <em>{{ highRatings }}</em> de {{ v('tus', 'sus') }} {{ ratings.count }} notas
            {{ highRatings === 1 ? 'es' : 'son' }} de <em>4★ o más</em>.<br />
            {{ ratingVerdict[0] }}<em>{{ ratingVerdict[1] }}</em>{{ ratingVerdict[2] }}
          </template>
        </InsightCard>

        <!-- Día más intenso -->
        <InsightCard
          v-else-if="key === 'day' && busiestDay"
          :title="`${v('Tu', 'Su')} día más intenso`"
          :label="`${busiestDay.day} ${busiestDay.month}`"
          :value="busiestDay.count"
          :unit="plural(busiestDay.count, 'obra', 'obras')"
          art-bg="raspberry"
        >
          <template #art>
            <InsightArt
              kind="day"
              :month="busiestDay.month.toUpperCase()"
              :day="busiestDay.day"
              :label="`Una hoja de calendario del ${busiestDay.day} de ${busiestDay.monthLong} que estalla, rodeada de una claqueta, un libro, un control y una nota musical`"
            />
          </template>
          El <em>{{ busiestDay.day }} de {{ busiestDay.monthLong }}</em> {{ v('registraste', 'registró') }}
          <em>{{ busiestDay.count }} {{ plural(busiestDay.count, 'obra', 'obras') }}</em>: {{ busiestDay.detail }}.
        </InsightCard>
      </template>
    </div>
  </template>
</template>

<style scoped>
.insights__title {
  margin: var(--space-xs) 0 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}

/* Teléfono: las cartas se deslizan de lado (una y un pedazo de la siguiente a la vista). */
.insights {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: min(78%, 300px);
  gap: var(--space-md);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;
  /* Aire para que la sombra y el saltito al pasar el mouse no se corten. */
  padding: 4px 2px var(--space-sm);
  margin: -4px -2px 0;
}

.insights > * {
  scroll-snap-align: start;
}

/* Escritorio: las cuatro en fila, más chicas, del ancho de la tarjeta. */
@container (min-width: 400px) {
  .insights {
    grid-auto-flow: row;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-auto-columns: auto;
    gap: clamp(6px, 1.6cqi, 14px);
    overflow: visible;
  }
}
</style>
